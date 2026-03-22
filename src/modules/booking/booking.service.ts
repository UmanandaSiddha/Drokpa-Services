import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from 'src/services/database/database.service';
import { CouponService } from '../coupon/coupon.service';
import { EmailService } from 'src/services/email/email.service';
import { LoggerService } from 'src/services/logger/logger.service';
import { BookingDateRequestStatus, BookingStatus, ProviderType } from 'generated/prisma/enums';
import { CreateTourBookingDto } from './dto/create-tour-booking.dto';
import { CreateTourQuoteDto } from './dto/create-tour-quote.dto';
import { CreateTourCustomDateRequestDto } from './dto/create-tour-custom-date-request.dto';
import { ApproveTourCustomDateRequestDto } from './dto/approve-tour-custom-date-request.dto';
import { RejectTourCustomDateRequestDto } from './dto/reject-tour-custom-date-request.dto';
import { CreateBookingFromCustomDateRequestDto } from './dto/create-booking-from-custom-date-request.dto';
import { CreateHomestayBookingDto } from './dto/create-homestay-booking.dto';
import { CreateVehicleBookingDto } from './dto/create-vehicle-booking.dto';
import { CreateGuideBookingDto } from './dto/create-guide-booking.dto';
import { CreateIlpBookingDto } from './dto/create-ilp-booking.dto';
import { ConfirmBookingDto } from './dto/confirm-booking.dto';
import { RejectBookingDto } from './dto/reject-booking.dto';
import { BookingGuestDto } from './dto/booking-guest.dto';

// ILP permit fee — fixed per person
const ILP_PRICE_PER_PERSON = 300;

// Default payment window before a booking expires
const DEFAULT_PAYMENT_WINDOW_MINUTES = 30;

// ─────────────────────────────────────────────
// Prisma include objects
// ─────────────────────────────────────────────

const BOOKING_ITEM_INCLUDE = {
    guests: true,
    rooms: {
        include: {
            room: {
                select: {
                    id: true,
                    name: true,
                    homestayId: true,
                    homestay: { select: { id: true, name: true, slug: true } },
                },
            },
        },
    },
    permits: true,
} as const;

const BOOKING_DETAIL_INCLUDE = {
    items: { include: BOOKING_ITEM_INCLUDE },
    payment: true,
    reviews: { select: { id: true, rating: true, comment: true, createdAt: true } },
    user: { select: { id: true, firstName: true, lastName: true, email: true } },
} as const;

const BOOKING_LIST_INCLUDE = {
    items: {
        select: {
            id: true,
            productType: true,
            productId: true,
            startDate: true,
            endDate: true,
            quantity: true,
            finalPrice: true,
            totalAmount: true,
        },
    },
    payment: { select: { id: true, status: true, amount: true } },
} as const;

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface PaginationOptions {
    status?: BookingStatus;
    page?: number;
    limit?: number;
}

interface AdminRequestListOptions {
    status?: BookingDateRequestStatus;
    page?: number;
    limit?: number;
}

@Injectable()
export class BookingService {
    private readonly logger = new LoggerService(BookingService.name);
    private readonly frontendUrl: string;

    constructor(
        private readonly databaseService: DatabaseService,
        private readonly couponService: CouponService,
        private readonly emailService: EmailService,
        private readonly configService: ConfigService,
    ) {
        this.frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'https://drokpa.in';
    }

    // ─────────────────────────────────────────
    // Quote (price preview — no side effects)
    // ─────────────────────────────────────────

    async quoteTourBooking(userId: string, dto: CreateTourQuoteDto) {
        const { tourId, participantCount, couponCode, addOnTrekIds } = dto;

        const tour = await this.databaseService.tour.findUnique({
            where: { id: tourId },
            select: {
                id: true,
                title: true,
                basePrice: true,
                discount: true,
                finalPrice: true,
                maxCapacity: true,
                isActive: true,
                customDateRequestEnabled: true,
                customDateMinParticipants: true,
                bookingRules: true,
                bookingConditions: true,
            },
        });

        if (!tour || !tour.isActive) {
            throw new NotFoundException('Tour not found');
        }

        if (participantCount > tour.maxCapacity) {
            throw new BadRequestException(
                `This tour has a maximum capacity of ${tour.maxCapacity} participants`,
            );
        }

        // Compute tour line total
        const tourLineTotal = tour.finalPrice * participantCount;

        // Compute add-on trek totals
        const addOnBreakdown: Array<{
            trekId: string;
            title: string;
            finalPrice: number;
            lineTotal: number;
        }> = [];

        if (addOnTrekIds && addOnTrekIds.length > 0) {
            const treks = await this.databaseService.tour.findMany({
                where: { id: { in: addOnTrekIds }, isActive: true },
                select: { id: true, title: true, finalPrice: true },
            });

            const foundIds = new Set(treks.map(t => t.id));
            for (const id of addOnTrekIds) {
                if (!foundIds.has(id)) {
                    throw new NotFoundException(`Add-on trek ${id} not found or not active`);
                }
            }

            for (const trek of treks) {
                addOnBreakdown.push({
                    trekId: trek.id,
                    title: trek.title,
                    finalPrice: trek.finalPrice,
                    lineTotal: trek.finalPrice * participantCount,
                });
            }
        }

        const addOnTotal = addOnBreakdown.reduce((sum, t) => sum + t.lineTotal, 0);
        const subtotal = tourLineTotal + addOnTotal;

        // Validate & compute coupon discount (read-only — don't record usage)
        let discountAmount = 0;
        let couponResult: { couponId: string; couponCode: string; discountAmount: number } | null =
            null;

        if (couponCode) {
            const user = await this.databaseService.user.findUnique({
                where: { id: userId },
                select: { id: true, roles: { select: { role: true } } },
            });
            couponResult = await this.couponService.validateAndCompute(couponCode, {
                userId,
                userRoles: user?.roles.map(r => r.role) ?? [],
                orderAmount: subtotal,
                participants: participantCount,
                productType: ProviderType.TOUR_VENDOR,
                productId: tourId,
            });
            discountAmount = couponResult.discountAmount;
        }

        const requiresCustomDateRequest =
            tour.customDateRequestEnabled &&
            tour.customDateMinParticipants !== null &&
            participantCount >= tour.customDateMinParticipants;

        return {
            tourId,
            participantCount,
            tourPrice: tour.finalPrice,
            tourLineTotal,
            addOnBreakdown,
            addOnTotal,
            subtotal,
            discountAmount,
            finalTotal: subtotal - discountAmount,
            couponApplied: couponResult
                ? {
                    code: couponResult.couponCode,
                    savings: couponResult.discountAmount,
                }
                : null,
            requiresCustomDateRequest,
            customDateMinParticipants: tour.customDateMinParticipants,
            bookingRules: tour.bookingRules,
            bookingConditions: tour.bookingConditions,
        };
    }

    // ─────────────────────────────────────────
    // Suggested treks for a tour
    // ─────────────────────────────────────────

    async getSuggestedTreksForTour(tourId: string, participants?: number) {
        const tour = await this.databaseService.tour.findUnique({
            where: { id: tourId },
            select: {
                id: true,
                suggestedTreks: {
                    where: { isActive: true },
                    orderBy: { displayOrder: 'asc' },
                    select: {
                        id: true,
                        rules: true,
                        conditions: true,
                        displayOrder: true,
                        trek: {
                            select: {
                                id: true,
                                title: true,
                                slug: true,
                                type: true,
                                basePrice: true,
                                finalPrice: true,
                                duration: true,
                                imageUrls: true,
                                maxAltitude: true,
                                distance: true,
                                bestSeason: true,
                                isActive: true,
                            },
                        },
                    },
                },
            },
        });

        if (!tour) {
            throw new NotFoundException('Tour not found');
        }

        return tour.suggestedTreks
            .filter(st => st.trek.isActive)
            .map(st => ({
                ...st,
                lineTotal: participants ? st.trek.finalPrice * participants : null,
            }));
    }

    // ─────────────────────────────────────────
    // Tour booking
    // ─────────────────────────────────────────

    async createTourBooking(userId: string, dto: CreateTourBookingDto) {
        const { tourId, startDate, guests, couponCode, addOnTrekIds } = dto;

        const tour = await this.databaseService.tour.findUnique({
            where: { id: tourId },
            select: {
                id: true,
                title: true,
                basePrice: true,
                discount: true,
                finalPrice: true,
                maxCapacity: true,
                customDateRequestEnabled: true,
                customDateMinParticipants: true,
                isActive: true,
            },
        });

        if (!tour || !tour.isActive) {
            throw new NotFoundException('Tour not found');
        }

        const participantCount = guests.length;

        if (participantCount > tour.maxCapacity) {
            throw new BadRequestException(
                `This tour has a maximum capacity of ${tour.maxCapacity} participants`,
            );
        }

        // Gate: large groups must use custom date request
        if (
            tour.customDateRequestEnabled &&
            tour.customDateMinParticipants !== null &&
            participantCount >= tour.customDateMinParticipants
        ) {
            throw new BadRequestException(
                `Groups of ${tour.customDateMinParticipants} or more must submit a custom date request for this tour`,
            );
        }

        // Fetch add-on treks
        const addOnTreks: Array<{ id: string; basePrice: number; discount: number; finalPrice: number }> =
            [];
        if (addOnTrekIds && addOnTrekIds.length > 0) {
            const treks = await this.databaseService.tour.findMany({
                where: { id: { in: addOnTrekIds }, isActive: true },
                select: { id: true, basePrice: true, discount: true, finalPrice: true },
            });
            if (treks.length !== addOnTrekIds.length) {
                throw new BadRequestException('One or more add-on trek IDs are invalid or inactive');
            }
            addOnTreks.push(...treks);
        }

        // Compute totals
        const tourLineTotal = tour.finalPrice * participantCount;
        const addOnLineTotal = addOnTreks.reduce((s, t) => s + t.finalPrice * participantCount, 0);
        const subtotal = tourLineTotal + addOnLineTotal;

        // Coupon
        const user = await this.databaseService.user.findUniqueOrThrow({
            where: { id: userId },
            select: { id: true, roles: { select: { role: true } } },
        });

        let couponId: string | undefined;
        let appliedCouponCode: string | undefined;
        let discountAmount = 0;

        if (couponCode) {
            const couponResult = await this.couponService.validateAndCompute(couponCode, {
                userId,
                userRoles: user.roles.map(r => r.role),
                orderAmount: subtotal,
                participants: participantCount,
                productType: ProviderType.TOUR_VENDOR,
                productId: tourId,
            });
            couponId = couponResult.couponId;
            appliedCouponCode = couponResult.couponCode;
            discountAmount = couponResult.discountAmount;
        }

        const totalAmount = subtotal - discountAmount;
        const expiresAt = new Date(Date.now() + DEFAULT_PAYMENT_WINDOW_MINUTES * 60 * 1000);

        // Build BookingItems create input
        const tourGuestsCreate = this.buildGuestsCreate(guests);

        const itemsCreate = [
            {
                productType: ProviderType.TOUR_VENDOR,
                productId: tourId,
                startDate: new Date(startDate),
                quantity: participantCount,
                basePrice: tour.basePrice,
                discount: tour.discount,
                finalPrice: tour.finalPrice,
                totalAmount: tourLineTotal,
                permitRequired: false,
                guests: { create: tourGuestsCreate },
            },
            ...addOnTreks.map(trek => ({
                productType: ProviderType.TOUR_VENDOR,
                productId: trek.id,
                startDate: new Date(startDate),
                quantity: participantCount,
                basePrice: trek.basePrice,
                discount: trek.discount,
                finalPrice: trek.finalPrice,
                totalAmount: trek.finalPrice * participantCount,
                permitRequired: false,
                guests: { create: tourGuestsCreate },
            })),
        ];

        const booking = await this.databaseService.booking.create({
            data: {
                userId,
                status: BookingStatus.AWAITING_PAYMENT,
                totalAmount,
                discountAmount,
                couponId: couponId ?? null,
                couponCode: appliedCouponCode ?? null,
                expiresAt,
                items: { create: itemsCreate },
            },
            include: BOOKING_DETAIL_INCLUDE,
        });

        // Record coupon usage after booking is committed
        if (couponId) {
            await this.couponService.recordUsage(couponId, userId, booking.id, discountAmount);
        }

        return {
            booking,
            checkoutUrl: this.buildCheckoutUrl(booking.id),
        };
    }

    // ─────────────────────────────────────────
    // ILP booking
    // ─────────────────────────────────────────

    async createIlpBooking(userId: string, dto: CreateIlpBookingDto) {
        const { startDate, guests, ilpProductId, couponCode, specialRequests } = dto;

        const participantCount = guests.length;
        const productId = ilpProductId ?? 'ILP-STANDARD';
        const unitPrice = ILP_PRICE_PER_PERSON;
        const subtotal = unitPrice * participantCount;

        const user = await this.databaseService.user.findUniqueOrThrow({
            where: { id: userId },
            select: { id: true, roles: { select: { role: true } } },
        });

        let couponId: string | undefined;
        let appliedCouponCode: string | undefined;
        let discountAmount = 0;

        if (couponCode) {
            const couponResult = await this.couponService.validateAndCompute(couponCode, {
                userId,
                userRoles: user.roles.map(r => r.role),
                orderAmount: subtotal,
                participants: participantCount,
                productType: ProviderType.ILP_VENDOR,
                productId,
            });
            couponId = couponResult.couponId;
            appliedCouponCode = couponResult.couponCode;
            discountAmount = couponResult.discountAmount;
        }

        const totalAmount = subtotal - discountAmount;
        const expiresAt = new Date(Date.now() + DEFAULT_PAYMENT_WINDOW_MINUTES * 60 * 1000);

        const booking = await this.databaseService.booking.create({
            data: {
                userId,
                status: BookingStatus.AWAITING_PAYMENT,
                totalAmount,
                discountAmount,
                couponId: couponId ?? null,
                couponCode: appliedCouponCode ?? null,
                expiresAt,
                items: {
                    create: [
                        {
                            productType: ProviderType.ILP_VENDOR,
                            productId,
                            startDate: new Date(startDate),
                            quantity: participantCount,
                            basePrice: unitPrice,
                            discount: 0,
                            finalPrice: unitPrice,
                            totalAmount: subtotal,
                            permitRequired: true,
                            metadata: { specialRequests: specialRequests ?? null },
                            guests: { create: this.buildGuestsCreate(guests) },
                        },
                    ],
                },
            },
            include: BOOKING_DETAIL_INCLUDE,
        });

        if (couponId) {
            await this.couponService.recordUsage(couponId, userId, booking.id, discountAmount);
        }

        return {
            booking,
            checkoutUrl: this.buildCheckoutUrl(booking.id),
        };
    }

    // ─────────────────────────────────────────
    // Homestay booking
    // ─────────────────────────────────────────

    async createHomestayBooking(userId: string, dto: CreateHomestayBookingDto) {
        const { roomId, checkIn, checkOut, guests, specialRequests, couponCode } = dto;

        const room = await this.databaseService.homestayRoom.findUnique({
            where: { id: roomId },
            select: {
                id: true,
                name: true,
                basePrice: true,
                capacity: true,
                discount: true,
                finalPrice: true,
                bookingCriteria: true,
                totalRooms: true,
                isActive: true,
                homestay: { select: { id: true, providerId: true, isActive: true } },
            },
        });

        if (!room || !room.isActive || !room.homestay.isActive) {
            throw new NotFoundException('Room not found or not available');
        }

        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);
        checkInDate.setHours(0, 0, 0, 0);
        checkOutDate.setHours(0, 0, 0, 0);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (checkInDate < today) {
            throw new BadRequestException('Check-in date cannot be in the past');
        }

        if (checkOutDate <= checkInDate) {
            throw new BadRequestException('Check-out date must be after check-in date');
        }

        const stayDates = this.buildDateRange(checkInDate, checkOutDate);
        const nights = stayDates.length;
        const roomsRequired = Math.max(1, Math.ceil(guests / room.capacity));

        if (roomsRequired > room.totalRooms) {
            throw new BadRequestException(
                `${room.name} can host up to ${room.capacity * room.totalRooms} guest(s) across ${room.totalRooms} room(s)`,
            );
        }

        // Compute total based on booking criteria
        let subtotal: number;
        if (room.bookingCriteria === 'PER_NIGHT') {
            subtotal = room.finalPrice * roomsRequired * nights;
        } else if (room.bookingCriteria === 'PER_PERSON') {
            subtotal = room.finalPrice * guests;
        } else {
            // HYBRID: PER_PERSON per night
            subtotal = room.finalPrice * guests * nights;
        }

        const user = await this.databaseService.user.findUniqueOrThrow({
            where: { id: userId },
            select: { id: true, roles: { select: { role: true } } },
        });

        let couponId: string | undefined;
        let appliedCouponCode: string | undefined;
        let discountAmount = 0;

        if (couponCode) {
            const couponResult = await this.couponService.validateAndCompute(couponCode, {
                userId,
                userRoles: user.roles.map(r => r.role),
                orderAmount: subtotal,
                participants: guests,
                productType: ProviderType.HOMESTAY_HOST,
                productId: roomId,
            });
            couponId = couponResult.couponId;
            appliedCouponCode = couponResult.couponCode;
            discountAmount = couponResult.discountAmount;
        }

        const totalAmount = subtotal - discountAmount;
        const expiresAt = new Date(Date.now() + DEFAULT_PAYMENT_WINDOW_MINUTES * 60 * 1000);

        const booking = await this.databaseService.$transaction(async tx => {
            await tx.roomAvailability.createMany({
                data: stayDates.map(date => ({
                    roomId,
                    date,
                    available: room.totalRooms,
                })),
                skipDuplicates: true,
            });

            const availability = await tx.roomAvailability.findMany({
                where: {
                    roomId,
                    date: { in: stayDates },
                },
                orderBy: { date: 'asc' },
            });

            const availabilityByDate = new Map(
                availability.map(record => [this.getDateKey(record.date), record.available]),
            );

            const firstUnavailableDate = stayDates.find(date => {
                const availableRooms = availabilityByDate.get(this.getDateKey(date)) ?? room.totalRooms;
                return availableRooms < roomsRequired;
            });

            if (firstUnavailableDate) {
                throw new BadRequestException(
                    `${room.name} does not have ${roomsRequired} room(s) available on ${this.getDateKey(firstUnavailableDate)}`,
                );
            }

            const reservationResults = await Promise.all(
                stayDates.map(date =>
                    tx.roomAvailability.updateMany({
                        where: {
                            roomId,
                            date,
                            available: { gte: roomsRequired },
                        },
                        data: {
                            available: { decrement: roomsRequired },
                        },
                    }),
                ),
            );

            if (reservationResults.some(result => result.count !== 1)) {
                throw new BadRequestException(
                    'Room availability changed while creating this booking. Please try again.',
                );
            }

            return tx.booking.create({
                data: {
                    userId,
                    status: BookingStatus.AWAITING_PAYMENT,
                    totalAmount,
                    discountAmount,
                    couponId: couponId ?? null,
                    couponCode: appliedCouponCode ?? null,
                    expiresAt,
                    items: {
                        create: [
                            {
                                productType: ProviderType.HOMESTAY_HOST,
                                productId: roomId,
                                startDate: checkInDate,
                                endDate: checkOutDate,
                                quantity: roomsRequired,
                                basePrice: room.basePrice,
                                discount: room.discount,
                                finalPrice: room.finalPrice,
                                totalAmount: subtotal,
                                permitRequired: false,
                                metadata: {
                                    rooms: roomsRequired,
                                    guests,
                                    nights,
                                    bookingCriteria: room.bookingCriteria,
                                },
                                rooms: {
                                    create: {
                                        roomId,
                                        checkIn: checkInDate,
                                        checkOut: checkOutDate,
                                        guests,
                                        specialRequests: specialRequests ?? null,
                                    },
                                },
                            },
                        ],
                    },
                },
                include: BOOKING_DETAIL_INCLUDE,
            });
        });

        if (couponId) {
            await this.couponService.recordUsage(couponId, userId, booking.id, discountAmount);
        }

        return {
            booking,
            checkoutUrl: this.buildCheckoutUrl(booking.id),
        };
    }

    // ─────────────────────────────────────────
    // Vehicle booking
    // ─────────────────────────────────────────

    async createVehicleBooking(userId: string, dto: CreateVehicleBookingDto) {
        const { vehicleId, startDate, endDate, quantity, couponCode } = dto;

        const vehicle = await this.databaseService.vehicle.findUnique({
            where: { id: vehicleId },
            select: { id: true, basePricePerDay: true, isActive: true },
        });

        if (!vehicle || !vehicle.isActive) {
            throw new NotFoundException('Vehicle not found or not available');
        }

        const startDateObj = new Date(startDate);
        const endDateObj = new Date(endDate);

        if (endDateObj <= startDateObj) {
            throw new BadRequestException('End date must be after start date');
        }

        const numDays = Math.ceil(
            (endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24),
        );
        const subtotal = vehicle.basePricePerDay * quantity * numDays;

        const user = await this.databaseService.user.findUniqueOrThrow({
            where: { id: userId },
            select: { id: true, roles: { select: { role: true } } },
        });

        let couponId: string | undefined;
        let appliedCouponCode: string | undefined;
        let discountAmount = 0;

        if (couponCode) {
            const couponResult = await this.couponService.validateAndCompute(couponCode, {
                userId,
                userRoles: user.roles.map(r => r.role),
                orderAmount: subtotal,
                productType: ProviderType.VEHICLE_PARTNER,
                productId: vehicleId,
            });
            couponId = couponResult.couponId;
            appliedCouponCode = couponResult.couponCode;
            discountAmount = couponResult.discountAmount;
        }

        const totalAmount = subtotal - discountAmount;
        const expiresAt = new Date(Date.now() + DEFAULT_PAYMENT_WINDOW_MINUTES * 60 * 1000);

        const booking = await this.databaseService.booking.create({
            data: {
                userId,
                status: BookingStatus.AWAITING_PAYMENT,
                totalAmount,
                discountAmount,
                couponId: couponId ?? null,
                couponCode: appliedCouponCode ?? null,
                expiresAt,
                items: {
                    create: [
                        {
                            productType: ProviderType.VEHICLE_PARTNER,
                            productId: vehicleId,
                            startDate: startDateObj,
                            endDate: endDateObj,
                            quantity: quantity * numDays,
                            basePrice: vehicle.basePricePerDay,
                            discount: 0,
                            finalPrice: vehicle.basePricePerDay,
                            totalAmount: subtotal,
                            permitRequired: false,
                            metadata: { quantity, numDays },
                        },
                    ],
                },
            },
            include: BOOKING_DETAIL_INCLUDE,
        });

        if (couponId) {
            await this.couponService.recordUsage(couponId, userId, booking.id, discountAmount);
        }

        return {
            booking,
            checkoutUrl: this.buildCheckoutUrl(booking.id),
        };
    }

    // ─────────────────────────────────────────
    // Guide booking
    // ─────────────────────────────────────────

    async createGuideBooking(userId: string, dto: CreateGuideBookingDto) {
        const { guideId, startDate, endDate, quantity, couponCode } = dto;

        const guide = await this.databaseService.localGuide.findUnique({
            where: { id: guideId },
            select: { id: true, basePricePerDay: true, isActive: true },
        });

        if (!guide || !guide.isActive) {
            throw new NotFoundException('Guide not found or not available');
        }

        const startDateObj = new Date(startDate);
        const endDateObj = new Date(endDate);

        if (endDateObj <= startDateObj) {
            throw new BadRequestException('End date must be after start date');
        }

        const numDays = Math.ceil(
            (endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24),
        );
        const subtotal = guide.basePricePerDay * quantity * numDays;

        const user = await this.databaseService.user.findUniqueOrThrow({
            where: { id: userId },
            select: { id: true, roles: { select: { role: true } } },
        });

        let couponId: string | undefined;
        let appliedCouponCode: string | undefined;
        let discountAmount = 0;

        if (couponCode) {
            const couponResult = await this.couponService.validateAndCompute(couponCode, {
                userId,
                userRoles: user.roles.map(r => r.role),
                orderAmount: subtotal,
                productType: ProviderType.LOCAL_GUIDE,
                productId: guideId,
            });
            couponId = couponResult.couponId;
            appliedCouponCode = couponResult.couponCode;
            discountAmount = couponResult.discountAmount;
        }

        const totalAmount = subtotal - discountAmount;
        const expiresAt = new Date(Date.now() + DEFAULT_PAYMENT_WINDOW_MINUTES * 60 * 1000);

        const booking = await this.databaseService.booking.create({
            data: {
                userId,
                status: BookingStatus.AWAITING_PAYMENT,
                totalAmount,
                discountAmount,
                couponId: couponId ?? null,
                couponCode: appliedCouponCode ?? null,
                expiresAt,
                items: {
                    create: [
                        {
                            productType: ProviderType.LOCAL_GUIDE,
                            productId: guideId,
                            startDate: startDateObj,
                            endDate: endDateObj,
                            quantity: quantity * numDays,
                            basePrice: guide.basePricePerDay,
                            discount: 0,
                            finalPrice: guide.basePricePerDay,
                            totalAmount: subtotal,
                            permitRequired: false,
                            metadata: { quantity, numDays },
                        },
                    ],
                },
            },
            include: BOOKING_DETAIL_INCLUDE,
        });

        if (couponId) {
            await this.couponService.recordUsage(couponId, userId, booking.id, discountAmount);
        }

        return {
            booking,
            checkoutUrl: this.buildCheckoutUrl(booking.id),
        };
    }

    // ─────────────────────────────────────────
    // Custom date requests
    // ─────────────────────────────────────────

    async createTourCustomDateRequest(userId: string, dto: CreateTourCustomDateRequestDto) {
        const {
            tourId,
            requestedStartDate,
            requestedEndDate,
            guests,
            addOnTrekIds,
            couponCode,
            specialRequests,
        } = dto;

        const tour = await this.databaseService.tour.findUnique({
            where: { id: tourId },
            select: {
                id: true,
                customDateRequestEnabled: true,
                customDateMinParticipants: true,
                isActive: true,
            },
        });

        if (!tour || !tour.isActive) {
            throw new NotFoundException('Tour not found');
        }

        if (!tour.customDateRequestEnabled) {
            throw new BadRequestException('Custom date requests are not enabled for this tour');
        }

        const participantCount = guests.length;

        if (
            tour.customDateMinParticipants !== null &&
            participantCount < tour.customDateMinParticipants
        ) {
            throw new BadRequestException(
                `Custom date requests require a minimum of ${tour.customDateMinParticipants} participants`,
            );
        }

        // Validate add-on trek IDs if provided
        if (addOnTrekIds && addOnTrekIds.length > 0) {
            const trekCount = await this.databaseService.tour.count({
                where: { id: { in: addOnTrekIds }, isActive: true },
            });
            if (trekCount !== addOnTrekIds.length) {
                throw new BadRequestException('One or more add-on trek IDs are invalid or inactive');
            }
        }

        const request = await this.databaseService.bookingDateRequest.create({
            data: {
                userId,
                tourId,
                requestedStartDate: new Date(requestedStartDate),
                requestedEndDate: requestedEndDate ? new Date(requestedEndDate) : null,
                participantsCount: participantCount,
                guests: guests as any,
                addOnTrekIds: addOnTrekIds ?? [],
                couponCode: couponCode ?? null,
                specialRequests: specialRequests ?? null,
                requestedThreshold: tour.customDateMinParticipants ?? null,
                status: BookingDateRequestStatus.PENDING,
            },
            include: {
                tour: { select: { id: true, title: true, slug: true } },
            },
        });

        return request;
    }

    async getMyTourCustomDateRequests(userId: string) {
        return this.databaseService.bookingDateRequest.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            include: {
                tour: { select: { id: true, title: true, slug: true, imageUrls: true } },
                createdBooking: { select: { id: true, status: true, totalAmount: true } },
            },
        });
    }

    async getTourCustomDateRequestsForAdmin(options: AdminRequestListOptions) {
        const { status, page = 1, limit = 20 } = options;
        const skip = (page - 1) * limit;

        const where = status ? { status } : {};

        const [data, total] = await this.databaseService.$transaction([
            this.databaseService.bookingDateRequest.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    user: { select: { id: true, firstName: true, lastName: true, email: true } },
                    tour: { select: { id: true, title: true, slug: true } },
                    reviewer: { select: { id: true, firstName: true, lastName: true } },
                },
            }),
            this.databaseService.bookingDateRequest.count({ where }),
        ]);

        return {
            data,
            meta: { total, page, limit, pages: Math.ceil(total / limit) },
        };
    }

    async getTourCustomDateRequestById(requestId: string, userId: string, isAdmin: boolean) {
        const request = await this.databaseService.bookingDateRequest.findUnique({
            where: { id: requestId },
            include: {
                user: { select: { id: true, firstName: true, lastName: true, email: true } },
                tour: { select: { id: true, title: true, slug: true, imageUrls: true } },
                reviewer: { select: { id: true, firstName: true, lastName: true } },
                createdBooking: { select: { id: true, status: true, totalAmount: true } },
            },
        });

        if (!request) {
            throw new NotFoundException('Request not found');
        }

        if (!isAdmin && request.userId !== userId) {
            throw new ForbiddenException('You are not authorized to view this request');
        }

        return request;
    }

    async approveTourCustomDateRequest(
        requestId: string,
        adminUserId: string,
        dto: ApproveTourCustomDateRequestDto,
    ) {
        const request = await this.findCustomDateRequestOrThrow(requestId);

        if (request.status !== BookingDateRequestStatus.PENDING) {
            throw new BadRequestException(
                `Request is already ${request.status.toLowerCase()} and cannot be approved`,
            );
        }

        return this.databaseService.bookingDateRequest.update({
            where: { id: requestId },
            data: {
                status: BookingDateRequestStatus.APPROVED,
                approvedStartDate: dto.approvedStartDate ? new Date(dto.approvedStartDate) : null,
                approvedEndDate: dto.approvedEndDate ? new Date(dto.approvedEndDate) : null,
                adminNote: dto.adminNote ?? null,
                reviewedBy: adminUserId,
                reviewedAt: new Date(),
            },
        });
    }

    async rejectTourCustomDateRequest(
        requestId: string,
        adminUserId: string,
        dto: RejectTourCustomDateRequestDto,
    ) {
        const request = await this.findCustomDateRequestOrThrow(requestId);

        if (request.status !== BookingDateRequestStatus.PENDING) {
            throw new BadRequestException(
                `Request is already ${request.status.toLowerCase()} and cannot be rejected`,
            );
        }

        return this.databaseService.bookingDateRequest.update({
            where: { id: requestId },
            data: {
                status: BookingDateRequestStatus.REJECTED,
                rejectionReason: dto.reason,
                adminNote: dto.adminNote ?? null,
                reviewedBy: adminUserId,
                reviewedAt: new Date(),
            },
        });
    }

    async createBookingFromTourCustomDateRequest(
        requestId: string,
        adminUserId: string,
        dto: CreateBookingFromCustomDateRequestDto,
    ) {
        const request = await this.databaseService.bookingDateRequest.findUnique({
            where: { id: requestId },
            include: {
                user: { select: { id: true, email: true, firstName: true, roles: { select: { role: true } } } },
                tour: {
                    select: {
                        id: true,
                        title: true,
                        basePrice: true,
                        discount: true,
                        finalPrice: true,
                        isActive: true,
                    },
                },
            },
        });

        if (!request) {
            throw new NotFoundException('Request not found');
        }

        if (request.status !== BookingDateRequestStatus.APPROVED) {
            throw new BadRequestException('Request must be approved before creating a booking');
        }

        if (request.createdBookingId) {
            throw new BadRequestException('A booking has already been created for this request');
        }

        const tour = request.tour;
        const user = request.user;
        const guests = request.guests as unknown as BookingGuestDto[];

        const participantCount = request.participantsCount;
        const startDate = dto.startDate
            ? new Date(dto.startDate)
            : (request.approvedStartDate ?? request.requestedStartDate);
        const endDate = dto.endDate
            ? new Date(dto.endDate)
            : (request.approvedEndDate ?? request.requestedEndDate ?? null);

        // Fetch add-on trek details
        const addOnTreks: Array<{ id: string; basePrice: number; discount: number; finalPrice: number }> =
            [];
        if (request.addOnTrekIds.length > 0) {
            const treks = await this.databaseService.tour.findMany({
                where: { id: { in: request.addOnTrekIds } },
                select: { id: true, basePrice: true, discount: true, finalPrice: true },
            });
            addOnTreks.push(...treks);
        }

        const tourLineTotal = tour.finalPrice * participantCount;
        const addOnLineTotal = addOnTreks.reduce((s, t) => s + t.finalPrice * participantCount, 0);
        const subtotal = tourLineTotal + addOnLineTotal;

        // Apply coupon if one was saved on the request
        let couponId: string | undefined;
        let appliedCouponCode: string | undefined;
        let discountAmount = 0;

        if (request.couponCode) {
            try {
                const couponResult = await this.couponService.validateAndCompute(request.couponCode, {
                    userId: user.id,
                    userRoles: user.roles.map(r => r.role),
                    orderAmount: subtotal,
                    participants: participantCount,
                    productType: ProviderType.TOUR_VENDOR,
                    productId: tour.id,
                });
                couponId = couponResult.couponId;
                appliedCouponCode = couponResult.couponCode;
                discountAmount = couponResult.discountAmount;
            } catch (err) {
                this.logger.warn(
                    `Coupon ${request.couponCode} on request ${requestId} is no longer valid: ${err?.message}`,
                );
            }
        }

        const totalAmount = subtotal - discountAmount;
        const paymentWindowMinutes = dto.paymentWindowMinutes ?? 72 * 60; // 3 day default for custom bookings
        const expiresAt = new Date(Date.now() + paymentWindowMinutes * 60 * 1000);

        const guestsCreate = this.buildGuestsCreate(guests);

        const itemsCreate = [
            {
                productType: ProviderType.TOUR_VENDOR,
                productId: tour.id,
                startDate,
                endDate,
                quantity: participantCount,
                basePrice: tour.basePrice,
                discount: tour.discount,
                finalPrice: tour.finalPrice,
                totalAmount: tourLineTotal,
                permitRequired: false,
                guests: { create: guestsCreate },
            },
            ...addOnTreks.map(trek => ({
                productType: ProviderType.TOUR_VENDOR,
                productId: trek.id,
                startDate,
                endDate,
                quantity: participantCount,
                basePrice: trek.basePrice,
                discount: trek.discount,
                finalPrice: trek.finalPrice,
                totalAmount: trek.finalPrice * participantCount,
                permitRequired: false,
                guests: { create: guestsCreate },
            })),
        ];

        const [booking] = await this.databaseService.$transaction(async tx => {
            const newBooking = await tx.booking.create({
                data: {
                    userId: user.id,
                    status: BookingStatus.AWAITING_PAYMENT,
                    totalAmount,
                    discountAmount,
                    couponId: couponId ?? null,
                    couponCode: appliedCouponCode ?? null,
                    expiresAt,
                    metadata: { createdFromRequestId: requestId, adminNote: dto.adminNote ?? null },
                    items: { create: itemsCreate },
                },
                include: BOOKING_DETAIL_INCLUDE,
            });

            await tx.bookingDateRequest.update({
                where: { id: requestId },
                data: {
                    status: BookingDateRequestStatus.BOOKING_CREATED,
                    createdBookingId: newBooking.id,
                    reviewedBy: adminUserId,
                    reviewedAt: new Date(),
                },
            });

            return [newBooking];
        });

        // Record coupon usage
        if (couponId) {
            await this.couponService.recordUsage(couponId, user.id, booking.id, discountAmount);
        }

        // Send checkout link email to user
        const checkoutUrl = this.buildCheckoutUrl(booking.id);
        await this.emailService.queueEmail({
            to: user.email,
            subject: `Your custom booking for ${tour.title} is ready`,
            html: this.buildCheckoutEmailHtml({
                firstName: user.firstName,
                tourTitle: tour.title,
                checkoutUrl,
                expiresAt,
                totalAmount,
                adminNote: dto.adminNote,
            }),
        });

        return {
            booking,
            checkoutUrl,
        };
    }

    // ─────────────────────────────────────────
    // Provider actions
    // ─────────────────────────────────────────

    async confirmBooking(bookingId: string, userId: string, dto: ConfirmBookingDto) {
        const booking = await this.databaseService.booking.findUnique({
            where: { id: bookingId },
            select: {
                id: true,
                status: true,
                items: { select: { id: true, productType: true, productId: true } },
            },
        });

        if (!booking) {
            throw new NotFoundException('Booking not found');
        }

        if (booking.status === BookingStatus.CONFIRMED) {
            throw new BadRequestException('Booking is already confirmed');
        }

        if (
            booking.status !== BookingStatus.REQUESTED &&
            booking.status !== BookingStatus.AWAITING_PAYMENT
        ) {
            throw new BadRequestException(
                `Cannot confirm a booking with status ${booking.status}`,
            );
        }

        const ownsItem = await this.providerOwnsAnyItem(userId, booking.items);
        if (!ownsItem) {
            throw new ForbiddenException('You are not authorized to confirm this booking');
        }

        return this.databaseService.booking.update({
            where: { id: bookingId },
            data: {
                status: BookingStatus.CONFIRMED,
                confirmedAt: new Date(),
                metadata: { confirmationNote: dto.notes ?? null },
            },
            include: BOOKING_DETAIL_INCLUDE,
        });
    }

    async rejectBooking(bookingId: string, userId: string, dto: RejectBookingDto) {
        const booking = await this.databaseService.booking.findUnique({
            where: { id: bookingId },
            select: {
                id: true,
                status: true,
                couponId: true,
                items: {
                    select: {
                        id: true,
                        productType: true,
                        productId: true,
                        quantity: true,
                        metadata: true,
                        startDate: true,
                        endDate: true,
                    },
                },
            },
        });

        if (!booking) {
            throw new NotFoundException('Booking not found');
        }

        const terminal: BookingStatus[] = [
            BookingStatus.REJECTED,
            BookingStatus.CANCELLED,
            BookingStatus.COMPLETED,
            BookingStatus.REFUNDED,
        ];

        if (terminal.includes(booking.status)) {
            throw new BadRequestException(`Booking is already in a terminal state: ${booking.status}`);
        }

        const ownsItem = await this.providerOwnsAnyItem(userId, booking.items);
        if (!ownsItem) {
            throw new ForbiddenException('You are not authorized to reject this booking');
        }

        const updated = await this.databaseService.$transaction(async tx => {
            for (const item of booking.items) {
                if (
                    item.productType === ProviderType.HOMESTAY_HOST &&
                    item.startDate &&
                    item.endDate
                ) {
                    const reservedRooms = this.getReservedRoomCount(item.quantity, item.metadata);
                    const stayDates = this.buildDateRange(item.startDate, item.endDate);

                    await Promise.all(
                        stayDates.map(date =>
                            tx.roomAvailability.upsert({
                                where: { roomId_date: { roomId: item.productId, date } },
                                create: {
                                    roomId: item.productId,
                                    date,
                                    available: reservedRooms,
                                },
                                update: {
                                    available: { increment: reservedRooms },
                                },
                            }),
                        ),
                    );
                }
            }

            return tx.booking.update({
                where: { id: bookingId },
                data: {
                    status: BookingStatus.REJECTED,
                    cancelledAt: new Date(),
                    cancellationReason: dto.reason,
                },
                include: BOOKING_DETAIL_INCLUDE,
            });
        });

        // Decrement coupon usage on rejection
        if (booking.couponId) {
            await this.couponService.decrementCurrentUses(booking.couponId);
        }

        return updated;
    }

    // ─────────────────────────────────────────
    // Queries
    // ─────────────────────────────────────────

    async getMyLastBookingForPrefill(userId: string) {
        const booking = await this.databaseService.booking.findFirst({
            where: {
                userId,
                status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
                items: {
                    some: {
                        guests: { some: {} },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            include: {
                items: {
                    take: 1,
                    include: {
                        guests: {
                            select: {
                                fullName: true,
                                contactNumber: true,
                                email: true,
                                age: true,
                                gender: true,
                            },
                        },
                    },
                },
            },
        });

        if (!booking) {
            return null;
        }

        // Return flattened guests from the first item for easy pre-fill
        const guests = booking.items.flatMap(item => item.guests);

        return { bookingId: booking.id, guests };
    }

    async getMyBookings(userId: string, options: PaginationOptions) {
        const { status, page = 1, limit = 10 } = options;
        const skip = (page - 1) * limit;
        const where = { userId, ...(status ? { status } : {}) };

        const [data, total] = await this.databaseService.$transaction([
            this.databaseService.booking.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: BOOKING_LIST_INCLUDE,
            }),
            this.databaseService.booking.count({ where }),
        ]);

        return {
            data,
            meta: { total, page, limit, pages: Math.ceil(total / limit) },
        };
    }

    async getProviderBookings(userId: string, options: PaginationOptions) {
        const { status, page = 1, limit = 10 } = options;
        const skip = (page - 1) * limit;

        const provider = await this.databaseService.provider.findUnique({
            where: { userId },
            select: { id: true },
        });

        if (!provider) {
            throw new NotFoundException('Provider profile not found');
        }

        // Collect all product IDs owned by this provider
        const [tourIds, roomIds, vehicleIds, guideIds] = await Promise.all([
            this.databaseService.tour
                .findMany({
                    where: { providerId: provider.id },
                    select: { id: true },
                })
                .then(items => items.map(i => i.id)),
            this.databaseService.homestayRoom
                .findMany({
                    where: { homestay: { providerId: provider.id } },
                    select: { id: true },
                })
                .then(items => items.map(i => i.id)),
            this.databaseService.vehicle
                .findMany({
                    where: { providerId: provider.id },
                    select: { id: true },
                })
                .then(items => items.map(i => i.id)),
            this.databaseService.localGuide
                .findMany({
                    where: { providerId: provider.id },
                    select: { id: true },
                })
                .then(items => items.map(i => i.id)),
        ]);

        const orClauses: any[] = [];
        if (tourIds.length > 0)
            orClauses.push({ productType: ProviderType.TOUR_VENDOR, productId: { in: tourIds } });
        if (roomIds.length > 0)
            orClauses.push({ productType: ProviderType.HOMESTAY_HOST, productId: { in: roomIds } });
        if (vehicleIds.length > 0)
            orClauses.push({ productType: ProviderType.VEHICLE_PARTNER, productId: { in: vehicleIds } });
        if (guideIds.length > 0)
            orClauses.push({ productType: ProviderType.LOCAL_GUIDE, productId: { in: guideIds } });

        if (orClauses.length === 0) {
            return { data: [], meta: { total: 0, page, limit, pages: 0 } };
        }

        const where: any = {
            items: { some: { OR: orClauses } },
            ...(status ? { status } : {}),
        };

        const [data, total] = await this.databaseService.$transaction([
            this.databaseService.booking.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: BOOKING_LIST_INCLUDE,
            }),
            this.databaseService.booking.count({ where }),
        ]);

        return {
            data,
            meta: { total, page, limit, pages: Math.ceil(total / limit) },
        };
    }

    async getBooking(bookingId: string, userId: string) {
        const booking = await this.databaseService.booking.findUnique({
            where: { id: bookingId },
            include: BOOKING_DETAIL_INCLUDE,
        });

        if (!booking) {
            throw new NotFoundException('Booking not found');
        }

        // Owner can always see their own booking
        if (booking.userId === userId) {
            return booking;
        }

        // Check if user is a provider with a product in this booking
        const ownsItem = await this.providerOwnsAnyItem(userId, booking.items as any);
        if (ownsItem) {
            return booking;
        }

        // Check if user is admin
        const userRoleMap = await this.databaseService.userRoleMap.findFirst({
            where: { userId, role: 'ADMIN' as any },
        });
        if (userRoleMap) {
            return booking;
        }

        throw new ForbiddenException('You are not authorized to view this booking');
    }

    // ─────────────────────────────────────────
    // Private helpers
    // ─────────────────────────────────────────

    private buildCheckoutUrl(bookingId: string): string {
        return `${this.frontendUrl}/checkout?bookingId=${bookingId}`;
    }

    private buildDateRange(startDate: Date, endDate: Date): Date[] {
        const dates: Date[] = [];
        const current = new Date(startDate);
        current.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(0, 0, 0, 0);

        while (current < end) {
            dates.push(new Date(current));
            current.setDate(current.getDate() + 1);
        }

        return dates;
    }

    private getDateKey(value: Date): string {
        const year = value.getFullYear();
        const month = String(value.getMonth() + 1).padStart(2, '0');
        const day = String(value.getDate()).padStart(2, '0');

        return `${year}-${month}-${day}`;
    }

    private getReservedRoomCount(quantity: number, metadata: unknown): number {
        if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
            const rooms = Number((metadata as { rooms?: unknown }).rooms);

            if (Number.isFinite(rooms) && rooms > 0) {
                return rooms;
            }
        }

        return quantity;
    }

    private buildGuestsCreate(guests: BookingGuestDto[]) {
        return guests.map(g => ({
            fullName: g.fullName,
            contactNumber: g.contactNumber,
            email: g.email ?? null,
            age: g.age,
            gender: g.gender,
            dateOfArrival: g.dateOfArrival ? new Date(g.dateOfArrival) : null,
        }));
    }

    private async findCustomDateRequestOrThrow(requestId: string) {
        const request = await this.databaseService.bookingDateRequest.findUnique({
            where: { id: requestId },
        });
        if (!request) {
            throw new NotFoundException('Custom date request not found');
        }
        return request;
    }

    private async providerOwnsAnyItem(
        userId: string,
        items: Array<{ productType: ProviderType; productId: string }>,
    ): Promise<boolean> {
        if (items.length === 0) return false;

        const provider = await this.databaseService.provider.findUnique({
            where: { userId },
            select: { id: true },
        });
        if (!provider) return false;

        const tourVendorIds = items
            .filter(i => i.productType === ProviderType.TOUR_VENDOR)
            .map(i => i.productId);

        const homestayHostIds = items
            .filter(i => i.productType === ProviderType.HOMESTAY_HOST)
            .map(i => i.productId);

        const vehiclePartnerIds = items
            .filter(i => i.productType === ProviderType.VEHICLE_PARTNER)
            .map(i => i.productId);

        const localGuideIds = items
            .filter(i => i.productType === ProviderType.LOCAL_GUIDE)
            .map(i => i.productId);

        const [tourCount, roomCount, vehicleCount, guideCount] = await Promise.all([
            tourVendorIds.length > 0
                ? this.databaseService.tour.count({
                    where: { id: { in: tourVendorIds }, providerId: provider.id },
                })
                : Promise.resolve(0),
            homestayHostIds.length > 0
                ? this.databaseService.homestayRoom.count({
                    where: {
                        id: { in: homestayHostIds },
                        homestay: { providerId: provider.id },
                    },
                })
                : Promise.resolve(0),
            vehiclePartnerIds.length > 0
                ? this.databaseService.vehicle.count({
                    where: { id: { in: vehiclePartnerIds }, providerId: provider.id },
                })
                : Promise.resolve(0),
            localGuideIds.length > 0
                ? this.databaseService.localGuide.count({
                    where: { id: { in: localGuideIds }, providerId: provider.id },
                })
                : Promise.resolve(0),
        ]);

        return tourCount + roomCount + vehicleCount + guideCount > 0;
    }

    private buildCheckoutEmailHtml(params: {
        firstName: string;
        tourTitle: string;
        checkoutUrl: string;
        expiresAt: Date;
        totalAmount: number;
        adminNote?: string;
    }): string {
        const { firstName, tourTitle, checkoutUrl, expiresAt, totalAmount, adminNote } = params;
        const expiryStr = expiresAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

        return `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
        <h2>Your custom booking is ready, ${firstName}!</h2>
        <p>Great news — your custom date request for <strong>${tourTitle}</strong> has been processed and your booking is ready for payment.</p>
        ${adminNote ? `<p><strong>Note from admin:</strong> ${adminNote}</p>` : ''}
        <p><strong>Total Amount:</strong> ₹${totalAmount.toLocaleString('en-IN')}</p>
        <p><strong>Payment deadline:</strong> ${expiryStr} (IST)</p>
        <p>Please complete your payment before the deadline to confirm your booking.</p>
        <a href="${checkoutUrl}"
           style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;margin-top:8px">
          Complete Payment
        </a>
        <p style="margin-top:24px;color:#6b7280;font-size:13px">
          If the button doesn't work, copy this link: ${checkoutUrl}
        </p>
        <p style="color:#6b7280;font-size:13px">— The Drokpa Team</p>
      </div>
    `;
    }
}
