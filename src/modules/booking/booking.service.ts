import {
    BadRequestException,
    Injectable,
    NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from 'src/services/database/database.service';
import { EmailService } from 'src/services/email/email.service';
import { AdminService } from 'src/modules/admin/admin.service';
import { LoggerService } from 'src/services/logger/logger.service';
import { CouponService } from 'src/modules/coupon/coupon.service';
import { CreateTourBookingDto } from './dto/create-tour-booking.dto';
import { CreateHomestayBookingDto } from './dto/create-homestay-booking.dto';
import { CreateVehicleBookingDto } from './dto/create-vehicle-booking.dto';
import { CreateGuideBookingDto } from './dto/create-guide-booking.dto';
import { ConfirmBookingDto } from './dto/confirm-booking.dto';
import { RejectBookingDto } from './dto/reject-booking.dto';
import {
    BookingStatus,
    BookingSource,
    ProviderType,
    PermitStatus,
    UserRole,
} from 'generated/prisma/enums';

// Payment window: how long a user has to complete payment after confirmation
const PAYMENT_WINDOW_MINUTES = 30;

@Injectable()
export class BookingService {
    private readonly logger = new LoggerService(BookingService.name);

    constructor(
        private readonly databaseService: DatabaseService,
        private readonly emailService: EmailService,
        private readonly adminService: AdminService,
        private readonly couponService: CouponService,
    ) { }

    // ─────────────────────────────────────────
    // Private helpers
    // ─────────────────────────────────────────

    /**
     * Resolves the providerId that owns a given product.
     * TOUR_VENDOR is platform-managed — providers cannot confirm/reject tours.
     */
    private async resolveProductProviderId(
        productType: ProviderType,
        productId: string,
    ): Promise<string | null> {
        switch (productType) {
            case ProviderType.HOMESTAY_HOST: {
                // productId on a homestay BookingItem is the roomId
                const room = await this.databaseService.homestayRoom.findUnique({
                    where: { id: productId },
                    include: { homestay: { select: { providerId: true } } },
                });
                return room?.homestay.providerId ?? null;
            }
            case ProviderType.VEHICLE_PARTNER: {
                const vehicle = await this.databaseService.vehicle.findUnique({
                    where: { id: productId },
                    select: { providerId: true },
                });
                return vehicle?.providerId ?? null;
            }
            case ProviderType.LOCAL_GUIDE: {
                const guide = await this.databaseService.localGuide.findUnique({
                    where: { id: productId },
                    select: { providerId: true },
                });
                return guide?.providerId ?? null;
            }
            default:
                // TOUR_VENDOR, ACTIVITY_VENDOR, ILP_VENDOR — platform-managed, no provider owner
                return null;
        }
    }

    /**
     * Resolves and returns the provider record for a given userId.
     * Throws ForbiddenException (not BadRequestException) if the user has no provider profile.
     */
    private async resolveProvider(userId: string) {
        const user = await this.databaseService.user.findUnique({
            where: { id: userId },
            include: { provider: { select: { id: true } } },
        });
        if (!user?.provider) {
            throw new ForbiddenException('User does not have a provider profile');
        }
        return user.provider;
    }

    /**
     * Returns the UserRole[] for a given userId.
     * Used to pass role context to the coupon validation engine.
     */
    private async getUserRoles(userId: string): Promise<UserRole[]> {
        const rolesMaps = await this.databaseService.userRoleMap.findMany({
            where: { userId },
            select: { role: true },
        });
        return rolesMaps.map(r => r.role);
    }

    /**
     * Sends booking request notifications to the user, an optional provider,
     * and all admins. Failures are logged but never thrown — notifications
     * should never break the booking flow.
     */
    private async sendBookingNotifications(payload: {
        bookingId: string;
        userId: string;
        productLabel: string;
        providerEmail?: string | null;
    }): Promise<void> {
        try {
            const user = await this.databaseService.user.findUnique({
                where: { id: payload.userId },
                select: { email: true, firstName: true, lastName: true },
            });

            const userName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim();

            if (user?.email) {
                await this.emailService.queueEmail({
                    to: user.email,
                    subject: 'Booking Request Received - Drokpa',
                    html: `
                        <p>Dear ${userName},</p>
                        <p>Your ${payload.productLabel} booking request has been received.</p>
                        <p><strong>Booking ID:</strong> ${payload.bookingId}</p>
                        <p>We will notify you once it is reviewed.</p>
                        <p>Thank you for choosing Drokpa!</p>
                    `,
                });
            }

            if (payload.providerEmail) {
                await this.emailService.sendBookingRequestNotification(
                    payload.providerEmail,
                    { id: payload.bookingId },
                );
            }

            const adminEmails = await this.adminService.getAdminEmails();
            await Promise.allSettled(
                adminEmails.map(adminEmail =>
                    this.emailService.queueEmail({
                        to: adminEmail,
                        subject: `New ${payload.productLabel} Booking Request - Drokpa`,
                        html: `
                            <p>Dear Admin,</p>
                            <p>A new ${payload.productLabel} booking request has been received.</p>
                            <p><strong>Booking ID:</strong> ${payload.bookingId}</p>
                            <p><strong>User:</strong> ${userName} (${user?.email})</p>
                        `,
                    }),
                ),
            );
        } catch (err) {
            // Notification failures must never break the booking flow
            this.logger.error(
                `Booking notification failed for ${payload.bookingId}: ${err instanceof Error ? err.message : String(err)}`,
                err instanceof Error ? err.stack : undefined,
            );
        }
    }

    // ─────────────────────────────────────────
    // Tour Booking
    // ─────────────────────────────────────────

    async createTourBooking(userId: string, dto: CreateTourBookingDto) {
        if (dto.guests.length === 0) {
            throw new BadRequestException('At least one guest is required');
        }

        const tour = await this.databaseService.tour.findUnique({
            where: { id: dto.tourId },
        });

        if (!tour || !tour.isActive) {
            throw new BadRequestException('Tour is not available');
        }

        // Check remaining capacity against already-booked seats —
        // never against maxCapacity alone (that ignores existing bookings)
        const bookedResult = await this.databaseService.bookingItem.aggregate({
            where: {
                productId: tour.id,
                productType: ProviderType.TOUR_VENDOR,
                booking: {
                    status: { in: [BookingStatus.CONFIRMED, BookingStatus.AWAITING_PAYMENT, BookingStatus.REQUESTED] },
                },
            },
            _sum: { quantity: true },
        });
        const alreadyBooked = bookedResult._sum.quantity ?? 0;
        const remaining = tour.maxCapacity - alreadyBooked;

        if (dto.guests.length > remaining) {
            throw new BadRequestException(
                `Only ${remaining} spot${remaining === 1 ? '' : 's'} remaining for this tour`,
            );
        }

        // Use stored finalPrice — it's already discount-applied and kept in sync
        const basePrice = tour.basePrice;
        const discount = tour.discount;
        const finalPrice = tour.finalPrice;
        const totalAmount = finalPrice * dto.guests.length;

        // ── Coupon: validate and compute discount (before transaction) ────────
        // We validate outside the tx so failed validation throws cleanly.
        // recordUsage() is called AFTER the tx so we never hold the DB locked.
        let couponResult: Awaited<ReturnType<CouponService['validateAndCompute']>> | null = null;
        if (dto.couponCode) {
            const userRoles = await this.getUserRoles(userId);
            couponResult = await this.couponService.validateAndCompute(dto.couponCode, {
                userId,
                userRoles,
                orderAmount: totalAmount,
                participants: dto.guests.length,
                productType: ProviderType.TOUR_VENDOR,
                productId: tour.id,
            });
        }
        const discountAmount = couponResult?.discountAmount ?? 0;

        const booking = await this.databaseService.$transaction(async tx => {
            const newBooking = await tx.booking.create({
                data: {
                    userId,
                    status: BookingStatus.REQUESTED,
                    source: BookingSource.ONLINE,
                    totalAmount,
                    discountAmount,
                    ...(couponResult && {
                        couponId: couponResult.couponId,
                        couponCode: couponResult.couponCode,
                    }),
                },
            });

            const item = await tx.bookingItem.create({
                data: {
                    bookingId: newBooking.id,
                    productType: ProviderType.TOUR_VENDOR,
                    productId: tour.id,
                    startDate: new Date(dto.startDate),
                    quantity: dto.guests.length,
                    basePrice,
                    discount,
                    finalPrice,
                    totalAmount,
                    permitRequired: true,
                },
            });

            for (const guest of dto.guests) {
                const bookingGuest = await tx.bookingGuest.create({
                    data: {
                        bookingItemId: item.id,
                        fullName: guest.fullName,
                        contactNumber: guest.contactNumber,
                        age: guest.age,
                        gender: guest.gender,
                        email: guest.email,
                    },
                });

                // Advance to COLLECTING_DOCS only if documents were already provided
                const hasDocuments = !!(guest.passportPhotoId && guest.identityProofId);

                await tx.permit.create({
                    data: {
                        bookingItemId: item.id,
                        participantId: bookingGuest.id,
                        status: hasDocuments ? PermitStatus.COLLECTING_DOCS : PermitStatus.REQUIRED,
                        ...(guest.passportPhotoId && { passportPhotoId: guest.passportPhotoId }),
                        ...(guest.identityProofId && { identityProofId: guest.identityProofId }),
                    },
                });
            }

            return newBooking;
        });

        // Record coupon usage AFTER the transaction (non-blocking audit)
        if (couponResult) {
            await this.couponService.recordUsage(
                couponResult.couponId,
                userId,
                booking.id,
                discountAmount,
            );
        }

        // Notifications run after transaction — never inside it
        await this.sendBookingNotifications({
            bookingId: booking.id,
            userId,
            productLabel: 'tour',
            // Tours are platform-managed — no provider to notify
        });

        return booking;
    }

    // ─────────────────────────────────────────
    // Homestay Booking
    // ─────────────────────────────────────────

    async createHomestayBooking(userId: string, dto: CreateHomestayBookingDto) {
        const checkIn = new Date(dto.checkIn);
        const checkOut = new Date(dto.checkOut);

        if (checkOut <= checkIn) {
            throw new BadRequestException('Check-out date must be after check-in date');
        }

        const nights = Math.ceil(
            (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24),
        );

        const room = await this.databaseService.homestayRoom.findUnique({
            where: { id: dto.roomId },
            include: {
                homestay: {
                    include: {
                        provider: { include: { user: { select: { email: true } } } },
                    },
                },
            },
        });

        if (!room || !room.isActive || !room.homestay.isActive) {
            throw new BadRequestException('Room is not available');
        }

        const providerEmail = room.homestay.provider.user?.email ?? null;

        // ── Coupon: validate BEFORE the transaction to keep tx short and avoid scope issues ──
        let couponResult: Awaited<ReturnType<CouponService['validateAndCompute']>> | null = null;
        if (dto.couponCode) {
            // totalAmount needed for validation — compute it pre-tx from known room prices
            const preTxTotalAmount = room.finalPrice * nights * dto.rooms;
            const userRoles = await this.getUserRoles(userId);
            couponResult = await this.couponService.validateAndCompute(dto.couponCode, {
                userId,
                userRoles,
                orderAmount: preTxTotalAmount,
                productType: ProviderType.HOMESTAY_HOST,
                productId: dto.roomId,
            });
        }
        const discountAmount = couponResult?.discountAmount ?? 0;

        const booking = await this.databaseService.$transaction(async tx => {
            // Lock availability rows for the date range inside the transaction
            const availability = await tx.roomAvailability.findMany({
                where: {
                    roomId: dto.roomId,
                    date: { gte: checkIn, lt: checkOut },
                },
            });

            // Every night in the range must have a configured availability record
            if (availability.length < nights) {
                throw new BadRequestException(
                    'Room availability is not configured for all selected dates',
                );
            }

            // All nights must have enough rooms
            const insufficientDate = availability.find(a => a.available < dto.rooms);
            if (insufficientDate) {
                throw new BadRequestException(
                    `Not enough rooms available on ${insufficientDate.date.toISOString().split('T')[0]}`,
                );
            }

            const basePrice = room.basePrice;
            const discount = room.discount;
            const finalPrice = room.finalPrice;
            const totalAmount = finalPrice * nights * dto.rooms;

            const newBooking = await tx.booking.create({
                data: {
                    userId,
                    status: BookingStatus.REQUESTED,
                    source: BookingSource.ONLINE,
                    totalAmount,
                    discountAmount,
                    ...(couponResult && {
                        couponId: couponResult.couponId,
                        couponCode: couponResult.couponCode,
                    }),
                },
            });

            const item = await tx.bookingItem.create({
                data: {
                    bookingId: newBooking.id,
                    productType: ProviderType.HOMESTAY_HOST,
                    productId: dto.roomId,
                    startDate: checkIn,
                    endDate: checkOut,
                    quantity: dto.rooms,
                    basePrice,
                    discount,
                    finalPrice,
                    totalAmount,
                    permitRequired: false,
                },
            });

            // RoomBooking links the booking item to the room with structured dates
            await tx.roomBooking.create({
                data: {
                    bookingItemId: item.id,
                    roomId: dto.roomId,
                    checkIn,
                    checkOut,
                    guests: dto.guests ?? 1,
                    specialRequests: dto.specialRequests,
                },
            });

            // Decrement availability at request time — prevents double-booking
            // between REQUESTED and CONFIRMED states. Re-incremented on REJECTED.
            await Promise.all(
                availability.map(avail =>
                    tx.roomAvailability.update({
                        where: { id: avail.id },
                        data: { available: { decrement: dto.rooms } },
                    }),
                ),
            );

            return newBooking;
        });

        // Record coupon usage AFTER tx
        if (couponResult) {
            await this.couponService.recordUsage(
                couponResult.couponId,
                userId,
                booking.id,
                discountAmount,
            );
        }

        await this.sendBookingNotifications({
            bookingId: booking.id,
            userId,
            productLabel: 'homestay',
            providerEmail,
        });

        return booking;
    }

    // ─────────────────────────────────────────
    // Vehicle Booking
    // ─────────────────────────────────────────

    async createVehicleBooking(userId: string, dto: CreateVehicleBookingDto) {
        const startDate = new Date(dto.startDate);
        const endDate = new Date(dto.endDate);

        if (endDate <= startDate) {
            throw new BadRequestException('End date must be after start date');
        }

        const vehicle = await this.databaseService.vehicle.findUnique({
            where: { id: dto.vehicleId },
            include: {
                provider: { include: { user: { select: { email: true } } } },
            },
        });

        if (!vehicle || !vehicle.isActive) {
            throw new BadRequestException('Vehicle is not available');
        }

        // ── Overlap conflict check ──────────────────────────────────────────
        // Two date ranges [A, B) and [C, D) overlap when A < D and B > C.
        // We only block active (non-rejected, non-cancelled, non-expired) bookings.
        const overlappingItem = await this.databaseService.bookingItem.findFirst({
            where: {
                productId: dto.vehicleId,
                productType: ProviderType.VEHICLE_PARTNER,
                startDate: { lt: endDate },
                endDate: { gt: startDate },
                booking: {
                    status: {
                        in: [
                            BookingStatus.REQUESTED,
                            BookingStatus.AWAITING_PAYMENT,
                            BookingStatus.CONFIRMED,
                        ],
                    },
                },
            },
            select: { id: true },
        });

        if (overlappingItem) {
            throw new BadRequestException(
                'This vehicle is already booked for the selected dates. Please choose different dates.',
            );
        }

        const days = Math.ceil(
            (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        const basePrice = vehicle.basePricePerDay;
        const discount = 0;
        const finalPrice = basePrice;
        const totalAmount = finalPrice * days * dto.quantity;
        const providerEmail = vehicle.provider.user?.email ?? null;

        // ── Coupon: validate outside the transaction ───────────────────────
        let couponResult: Awaited<ReturnType<CouponService['validateAndCompute']>> | null = null;
        if (dto.couponCode) {
            const userRoles = await this.getUserRoles(userId);
            couponResult = await this.couponService.validateAndCompute(dto.couponCode, {
                userId,
                userRoles,
                orderAmount: totalAmount,
                productType: ProviderType.VEHICLE_PARTNER,
                productId: vehicle.id,
            });
        }
        const discountAmount = couponResult?.discountAmount ?? 0;

        const booking = await this.databaseService.$transaction(async tx => {
            const newBooking = await tx.booking.create({
                data: {
                    userId,
                    status: BookingStatus.REQUESTED,
                    source: BookingSource.ONLINE,
                    totalAmount,
                    discountAmount,
                    ...(couponResult && {
                        couponId: couponResult.couponId,
                        couponCode: couponResult.couponCode,
                    }),
                },
            });

            await tx.bookingItem.create({
                data: {
                    bookingId: newBooking.id,
                    productType: ProviderType.VEHICLE_PARTNER,
                    productId: vehicle.id,
                    startDate,
                    endDate,
                    quantity: dto.quantity,
                    basePrice,
                    discount,
                    finalPrice,
                    totalAmount,
                    permitRequired: false,
                },
            });

            return newBooking;
        });

        // Record coupon usage AFTER tx
        if (couponResult) {
            await this.couponService.recordUsage(
                couponResult.couponId,
                userId,
                booking.id,
                discountAmount,
            );
        }

        await this.sendBookingNotifications({
            bookingId: booking.id,
            userId,
            productLabel: 'vehicle',
            providerEmail,
        });

        return booking;
    }

    // ─────────────────────────────────────────
    // Guide Booking
    // ─────────────────────────────────────────

    async createGuideBooking(userId: string, dto: CreateGuideBookingDto) {
        const startDate = new Date(dto.startDate);
        const endDate = new Date(dto.endDate);

        if (endDate <= startDate) {
            throw new BadRequestException('End date must be after start date');
        }

        const guide = await this.databaseService.localGuide.findUnique({
            where: { id: dto.guideId },
            include: {
                provider: { include: { user: { select: { email: true } } } },
            },
        });

        if (!guide || !guide.isActive) {
            throw new BadRequestException('Guide is not available');
        }

        // ── Overlap conflict check ──────────────────────────────────────────
        // A guide typically works with one group at a time.
        // Block bookings that overlap with any active booking for the same guide.
        const overlappingItem = await this.databaseService.bookingItem.findFirst({
            where: {
                productId: dto.guideId,
                productType: ProviderType.LOCAL_GUIDE,
                startDate: { lt: endDate },
                endDate: { gt: startDate },
                booking: {
                    status: {
                        in: [
                            BookingStatus.REQUESTED,
                            BookingStatus.AWAITING_PAYMENT,
                            BookingStatus.CONFIRMED,
                        ],
                    },
                },
            },
            select: { id: true },
        });

        if (overlappingItem) {
            throw new BadRequestException(
                'This guide is already booked for the selected dates. Please choose different dates.',
            );
        }

        const days = Math.ceil(
            (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        const basePrice = guide.basePricePerDay;
        const discount = 0;
        const finalPrice = basePrice;
        const totalAmount = finalPrice * days * dto.quantity;
        const providerEmail = guide.provider.user?.email ?? null;

        // ── Coupon: validate outside the transaction ───────────────────────
        let couponResult: Awaited<ReturnType<CouponService['validateAndCompute']>> | null = null;
        if (dto.couponCode) {
            const userRoles = await this.getUserRoles(userId);
            couponResult = await this.couponService.validateAndCompute(dto.couponCode, {
                userId,
                userRoles,
                orderAmount: totalAmount,
                productType: ProviderType.LOCAL_GUIDE,
                productId: guide.id,
            });
        }
        const discountAmount = couponResult?.discountAmount ?? 0;

        const booking = await this.databaseService.$transaction(async tx => {
            const newBooking = await tx.booking.create({
                data: {
                    userId,
                    status: BookingStatus.REQUESTED,
                    source: BookingSource.ONLINE,
                    totalAmount,
                    discountAmount,
                    ...(couponResult && {
                        couponId: couponResult.couponId,
                        couponCode: couponResult.couponCode,
                    }),
                },
            });

            await tx.bookingItem.create({
                data: {
                    bookingId: newBooking.id,
                    productType: ProviderType.LOCAL_GUIDE,
                    productId: guide.id,
                    startDate,
                    endDate,
                    quantity: dto.quantity,
                    basePrice,
                    discount,
                    finalPrice,
                    totalAmount,
                    permitRequired: false,
                },
            });

            return newBooking;
        });

        // Record coupon usage AFTER tx
        if (couponResult) {
            await this.couponService.recordUsage(
                couponResult.couponId,
                userId,
                booking.id,
                discountAmount,
            );
        }

        await this.sendBookingNotifications({
            bookingId: booking.id,
            userId,
            productLabel: 'local guide',
            providerEmail,
        });

        return booking;
    }

    // ─────────────────────────────────────────
    // Confirm Booking (Provider action)
    // ─────────────────────────────────────────

    async confirmBooking(bookingId: string, userId: string, dto: ConfirmBookingDto) {
        const provider = await this.resolveProvider(userId);

        const booking = await this.databaseService.booking.findUnique({
            where: { id: bookingId },
            include: {
                items: true,
                user: { select: { email: true, firstName: true, lastName: true } },
            },
        });

        if (!booking) throw new NotFoundException('Booking not found');
        if (booking.status !== BookingStatus.REQUESTED) {
            throw new BadRequestException(
                `Booking cannot be confirmed from status: ${booking.status}`,
            );
        }

        const item = booking.items[0];

        // Tours are platform-managed — providers cannot confirm them
        if (item.productType === ProviderType.TOUR_VENDOR) {
            throw new ForbiddenException(
                'Tour bookings are managed by the platform. Contact admin.',
            );
        }

        const productProviderId = await this.resolveProductProviderId(
            item.productType,
            item.productId,
        );

        if (!productProviderId || productProviderId !== provider.id) {
            throw new ForbiddenException(
                'You do not have permission to confirm this booking',
            );
        }

        // For homestay: availability was already decremented at request time.
        // Re-validate here to catch edge cases (manual admin changes, etc.)
        if (
            item.productType === ProviderType.HOMESTAY_HOST &&
            item.startDate &&
            item.endDate
        ) {
            const availability = await this.databaseService.roomAvailability.findMany({
                where: {
                    roomId: item.productId,
                    date: { gte: item.startDate, lt: item.endDate },
                },
            });

            const insufficient = availability.find(a => a.available < 0);
            if (insufficient) {
                throw new BadRequestException(
                    'Room availability is no longer sufficient for this booking',
                );
            }
        }

        const expiresAt = new Date(Date.now() + PAYMENT_WINDOW_MINUTES * 60 * 1000);

        const updatedBooking = await this.databaseService.booking.update({
            where: { id: bookingId },
            data: {
                status: BookingStatus.AWAITING_PAYMENT,
                confirmedAt: new Date(),
                expiresAt,
            },
        });

        // Notifications after DB write — never inside transaction
        if (booking.user?.email) {
            await this.emailService.queueEmail({
                to: booking.user.email,
                subject: 'Booking Confirmed — Payment Required',
                html: `
                    <p>Dear ${booking.user.firstName},</p>
                    <p>Your booking has been confirmed. Please complete your payment within ${PAYMENT_WINDOW_MINUTES} minutes.</p>
                    <p><strong>Booking ID:</strong> ${bookingId}</p>
                    <p><strong>Payment deadline:</strong> ${expiresAt.toISOString()}</p>
                `,
            }).catch(err =>
                this.logger.error(
                    `Failed to send confirm email for booking ${bookingId}: ${err instanceof Error ? err.message : String(err)}`,
                    err instanceof Error ? err.stack : undefined,
                ),
            );
        }

        return updatedBooking;
    }

    // ─────────────────────────────────────────
    // Reject Booking (Provider action)
    // ─────────────────────────────────────────

    async rejectBooking(bookingId: string, userId: string, dto: RejectBookingDto) {
        const provider = await this.resolveProvider(userId);

        const booking = await this.databaseService.booking.findUnique({
            where: { id: bookingId },
            include: {
                items: true,
                user: { select: { email: true, firstName: true, lastName: true } },
            },
        });

        if (!booking) throw new NotFoundException('Booking not found');
        if (booking.status !== BookingStatus.REQUESTED) {
            throw new BadRequestException(
                `Booking cannot be rejected from status: ${booking.status}`,
            );
        }

        const item = booking.items[0];

        if (item.productType === ProviderType.TOUR_VENDOR) {
            throw new ForbiddenException(
                'Tour bookings are managed by the platform. Contact admin.',
            );
        }

        const productProviderId = await this.resolveProductProviderId(
            item.productType,
            item.productId,
        );

        if (!productProviderId || productProviderId !== provider.id) {
            throw new ForbiddenException(
                'You do not have permission to reject this booking',
            );
        }

        // Re-increment availability for homestay on rejection
        // (was decremented at request time to prevent double-booking)
        if (
            item.productType === ProviderType.HOMESTAY_HOST &&
            item.startDate &&
            item.endDate
        ) {
            await this.databaseService.$transaction(async tx => {
                const availability = await tx.roomAvailability.findMany({
                    where: {
                        roomId: item.productId,
                        date: { gte: item.startDate!, lt: item.endDate! },
                    },
                });

                await Promise.all(
                    availability.map(avail =>
                        tx.roomAvailability.update({
                            where: { id: avail.id },
                            data: { available: { increment: item.quantity } },
                        }),
                    ),
                );

                await tx.booking.update({
                    where: { id: bookingId },
                    data: {
                        status: BookingStatus.REJECTED,
                        cancellationReason: dto.reason,
                        cancelledAt: new Date(),
                    },
                });
            });
        } else {
            await this.databaseService.booking.update({
                where: { id: bookingId },
                data: {
                    status: BookingStatus.REJECTED,
                    cancellationReason: dto.reason,
                    cancelledAt: new Date(),
                },
            });
        }

        // ── Coupon: free up the usage slot if the booking had a coupon applied ──────
        // Must be called AFTER the DB update so the slot is only freed on success.
        // Non-blocking — booking rejection is already persisted above.
        if (booking.couponId) {
            await this.couponService.decrementCurrentUses(booking.couponId);
        }

        if (booking.user?.email) {
            await this.emailService.queueEmail({
                to: booking.user.email,
                subject: 'Booking Request Rejected',
                html: `
                    <p>Dear ${booking.user.firstName},</p>
                    <p>Unfortunately your booking request has been rejected.</p>
                    <p><strong>Booking ID:</strong> ${bookingId}</p>
                    ${dto.reason ? `<p><strong>Reason:</strong> ${dto.reason}</p>` : ''}
                    <p>Please feel free to explore other options on Drokpa.</p>
                `,
            }).catch(err =>
                this.logger.error(
                    `Failed to send rejection email for booking ${bookingId}: ${err instanceof Error ? err.message : String(err)}`,
                    err instanceof Error ? err.stack : undefined,
                ),
            );
        }

        return this.databaseService.booking.findUnique({
            where: { id: bookingId },
        });
    }

    // ─────────────────────────────────────────
    // Get Booking
    // ─────────────────────────────────────────

    async getBooking(bookingId: string, userId?: string) {
        const booking = await this.databaseService.booking.findUnique({
            where: { id: bookingId },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                items: {
                    include: {
                        guests: { include: { permit: true } },
                        permits: true,
                        rooms: true,
                    },
                },
                payment: true,
            },
        });

        if (!booking) throw new NotFoundException('Booking not found');

        if (userId && booking.userId !== userId) {
            throw new ForbiddenException('You do not have access to this booking');
        }

        return booking;
    }

    // ─────────────────────────────────────────
    // Get My Bookings (User)
    // ─────────────────────────────────────────

    async getMyBookings(
        userId: string,
        options: { status?: BookingStatus; page?: number; limit?: number } = {},
    ) {
        const page = options.page ?? 1;
        const limit = options.limit ?? 10;
        const skip = (page - 1) * limit;

        const [bookings, total] = await Promise.all([
            this.databaseService.booking.findMany({
                where: {
                    userId,
                    ...(options.status && { status: options.status }),
                },
                include: {
                    items: {
                        include: { guests: true, rooms: true },
                    },
                    payment: true,
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip,
            }),
            this.databaseService.booking.count({
                where: {
                    userId,
                    ...(options.status && { status: options.status }),
                },
            }),
        ]);

        return {
            data: bookings,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        };
    }

    // ─────────────────────────────────────────
    // Get Provider Bookings
    // ─────────────────────────────────────────

    async getProviderBookings(
        userId: string,
        options: { status?: BookingStatus; page?: number; limit?: number } = {},
    ) {
        const provider = await this.resolveProvider(userId);
        const page = options.page ?? 1;
        const limit = options.limit ?? 10;
        const skip = (page - 1) * limit;

        // Fetch all provider product IDs in parallel
        const [homestayRooms, vehicles, guides] = await Promise.all([
            // For homestay, BookingItem.productId is roomId — query rooms not homestays
            this.databaseService.homestayRoom.findMany({
                where: { homestay: { providerId: provider.id } },
                select: { id: true },
            }),
            this.databaseService.vehicle.findMany({
                where: { providerId: provider.id },
                select: { id: true },
            }),
            this.databaseService.localGuide.findMany({
                where: { providerId: provider.id },
                select: { id: true },
            }),
        ]);

        const roomIds = homestayRooms.map(r => r.id);
        const vehicleIds = vehicles.map(v => v.id);
        const guideIds = guides.map(g => g.id);

        const where = {
            ...(options.status && { status: options.status }),
            items: {
                some: {
                    OR: [
                        ...(roomIds.length
                            ? [{ productType: ProviderType.HOMESTAY_HOST, productId: { in: roomIds } }]
                            : []),
                        ...(vehicleIds.length
                            ? [{ productType: ProviderType.VEHICLE_PARTNER, productId: { in: vehicleIds } }]
                            : []),
                        ...(guideIds.length
                            ? [{ productType: ProviderType.LOCAL_GUIDE, productId: { in: guideIds } }]
                            : []),
                    ],
                },
            },
        };

        const [bookings, total] = await Promise.all([
            this.databaseService.booking.findMany({
                where,
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            firstName: true,
                            lastName: true,
                        },
                    },
                    items: {
                        include: { guests: true, rooms: true },
                    },
                    payment: true,
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip,
            }),
            this.databaseService.booking.count({ where }),
        ]);

        return {
            data: bookings,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        };
    }
}