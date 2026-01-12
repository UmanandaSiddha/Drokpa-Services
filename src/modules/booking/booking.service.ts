import { BadRequestException, Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { DatabaseService } from "src/services/database/database.service";
import { EmailService } from "src/services/email/email.service";
import { AdminService } from "src/modules/admin/admin.service";
import { CreateTourBookingDto } from "./dto/create-tour-booking.dto";
import { CreateHomestayBookingDto } from "./dto/create-homestay-booking.dto";
import { CreateVehicleBookingDto } from "./dto/create-vehicle-booking.dto";
import { CreateGuideBookingDto } from "./dto/create-guide-booking.dto";
import { ConfirmBookingDto } from "./dto/confirm-booking.dto";
import { RejectBookingDto } from "./dto/reject-booking.dto";
import { BookingStatus, ProductType, PermitStatus } from "generated/prisma/enums";

@Injectable()
export class BookingService {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly emailService: EmailService,
        private readonly adminService: AdminService,
    ) { }

    async createTourBooking(userId: string, payload: CreateTourBookingDto) {
        const tour = await this.databaseService.tour.findUnique({
            where: { id: payload.tourId },
        });

        if (!tour || !tour.isActive) {
            throw new BadRequestException('Tour not available');
        }

        if (payload.guests.length > tour.maxCapacity) {
            throw new BadRequestException(`Maximum capacity is ${tour.maxCapacity} guests`);
        }

        if (payload.guests.length === 0) {
            throw new BadRequestException('At least one guest is required');
        }

        return this.databaseService.$transaction(async tx => {
            const booking = await tx.booking.create({
                data: {
                    userId,
                    status: BookingStatus.REQUESTED,
                    source: 'ONLINE',
                },
            });

            const item = await tx.bookingItem.create({
                data: {
                    bookingId: booking.id,
                    productType: ProductType.TOUR,
                    productId: tour.id,
                    startDate: new Date(payload.startDate),
                    quantity: payload.guests.length,
                    price: tour.price * payload.guests.length,
                    permitRequired: true, // Tours require permits
                },
            });

            // Create guests and permits
            for (const guest of payload.guests) {
                const bookingGuest = await tx.bookingGuest.create({
                    data: {
                        bookingItemId: item.id,
                        fullName: guest.fullName,
                        contactNumber: guest.contactNumber,
                        age: guest.age,
                        gender: guest.gender,
                    },
                });

                // Create permit for each guest
                await tx.permit.create({
                    data: {
                        bookingItemId: item.id,
                        participantId: bookingGuest.id,
                        status: PermitStatus.COLLECTING_DOCS,
                        ...(guest.passportPhotoId && { passportPhotoId: guest.passportPhotoId }),
                        ...(guest.identityProofId && { identityProofId: guest.identityProofId }),
                    },
                });
            }

            return booking;
        }).then(async (booking) => {
            // Send notifications after transaction
            const user = await this.databaseService.user.findUnique({
                where: { id: userId },
                select: { email: true, firstName: true, lastName: true },
            });

            // Notify user
            if (user?.email) {
                await this.emailService.queueEmail({
                    to: user.email,
                    subject: 'Booking Request Received - Drokpa',
                    html: `
                        <p>Dear ${user.firstName} ${user.lastName},</p>
                        <p>Your tour booking request has been received successfully.</p>
                        <p><strong>Booking ID:</strong> ${booking.id}</p>
                        <p>We will review your request and notify you once it's confirmed.</p>
                        <p>Thank you for choosing Drokpa!</p>
                    `,
                });
            }

            // Notify all admins
            const adminEmails = await this.adminService.getAdminEmails();
            for (const adminEmail of adminEmails) {
                await this.emailService.queueEmail({
                    to: adminEmail,
                    subject: 'New Tour Booking Request - Drokpa',
                    html: `
                        <p>Dear Admin,</p>
                        <p>A new tour booking request has been received.</p>
                        <p><strong>Booking ID:</strong> ${booking.id}</p>
                        <p><strong>User:</strong> ${user?.firstName} ${user?.lastName} (${user?.email})</p>
                        <p>Please review and process the booking.</p>
                    `,
                });
            }

            return booking;
        });
    }

    async createHomestayBooking(userId: string, dto: CreateHomestayBookingDto) {
        const checkIn = new Date(dto.checkIn);
        const checkOut = new Date(dto.checkOut);

        if (checkOut <= checkIn) {
            throw new BadRequestException('Check-out date must be after check-in date');
        }

        return this.databaseService.$transaction(async tx => {
            const room = await tx.homestayRoom.findUnique({
                where: { id: dto.roomId },
                include: {
                    homestay: {
                        include: {
                            provider: {
                                include: {
                                    user: true,
                                },
                            },
                        },
                    },
                },
            });

            if (!room || !room.homestay.isActive) {
                throw new BadRequestException('Room not available');
            }

            // Check availability
            const availability = await tx.roomAvailability.findMany({
                where: {
                    roomId: dto.roomId,
                    date: {
                        gte: checkIn,
                        lt: checkOut,
                    },
                },
            });

            if (availability.length === 0) {
                throw new BadRequestException('Room not available for selected dates');
            }

            if (availability.some(a => a.available < dto.rooms)) {
                throw new BadRequestException('Not enough rooms available');
            }

            const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
            const totalPrice = room.basePrice * nights * dto.rooms;

            const booking = await tx.booking.create({
                data: {
                    userId,
                    status: BookingStatus.REQUESTED,
                    source: 'ONLINE',
                },
            });

            await tx.bookingItem.create({
                data: {
                    bookingId: booking.id,
                    productType: ProductType.HOMESTAY,
                    productId: dto.roomId,
                    startDate: checkIn,
                    endDate: checkOut,
                    quantity: dto.rooms,
                    price: totalPrice,
                    permitRequired: false,
                },
            });

            return booking;
        }).then(async (booking) => {
            // Send notifications after transaction
            const user = await this.databaseService.user.findUnique({
                where: { id: userId },
                select: { email: true, firstName: true, lastName: true },
            });

            // Fetch room again for notifications (outside transaction scope)
            const room = await this.databaseService.homestayRoom.findUnique({
                where: { id: dto.roomId },
                include: {
                    homestay: {
                        include: {
                            provider: {
                                include: {
                                    user: true,
                                },
                            },
                        },
                    },
                },
            });

            // Notify user
            if (user?.email) {
                await this.emailService.queueEmail({
                    to: user.email,
                    subject: 'Booking Request Received - Drokpa',
                    html: `
                        <p>Dear ${user.firstName} ${user.lastName},</p>
                        <p>Your homestay booking request has been received successfully.</p>
                        <p><strong>Booking ID:</strong> ${booking.id}</p>
                        <p>The host will review your request and notify you once it's confirmed.</p>
                        <p>Thank you for choosing Drokpa!</p>
                    `,
                });
            }

            // Notify provider
            if (room?.homestay.provider.user?.email) {
                await this.emailService.sendBookingRequestNotification(
                    room.homestay.provider.user.email,
                    { id: booking.id },
                );
            }

            // Notify all admins
            const adminEmails = await this.adminService.getAdminEmails();
            for (const adminEmail of adminEmails) {
                await this.emailService.queueEmail({
                    to: adminEmail,
                    subject: 'New Homestay Booking Request - Drokpa',
                    html: `
                        <p>Dear Admin,</p>
                        <p>A new homestay booking request has been received.</p>
                        <p><strong>Booking ID:</strong> ${booking.id}</p>
                        <p><strong>User:</strong> ${user?.firstName} ${user?.lastName} (${user?.email})</p>
                        <p>Please monitor the booking status.</p>
                    `,
                });
            }

            return booking;
        });
    }

    async createVehicleBooking(userId: string, dto: CreateVehicleBookingDto) {
        const startDate = new Date(dto.startDate);
        const endDate = new Date(dto.endDate);

        if (endDate <= startDate) {
            throw new BadRequestException('End date must be after start date');
        }

        const vehicle = await this.databaseService.vehicle.findUnique({
            where: { id: dto.vehicleId },
            include: {
                provider: {
                    include: {
                        user: true,
                    },
                },
            },
        });

        if (!vehicle || !vehicle.isActive) {
            throw new BadRequestException('Vehicle not available');
        }

        const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const totalPrice = vehicle.basePricePerDay * days * dto.quantity;

        return this.databaseService.$transaction(async tx => {
            const booking = await tx.booking.create({
                data: {
                    userId,
                    status: BookingStatus.REQUESTED,
                    source: 'ONLINE',
                },
            });

            await tx.bookingItem.create({
                data: {
                    bookingId: booking.id,
                    productType: ProductType.VEHICLE,
                    productId: vehicle.id,
                    startDate,
                    endDate,
                    quantity: dto.quantity,
                    price: totalPrice,
                    permitRequired: false,
                },
            });

            return booking;
        }).then(async (booking) => {
            // Send notifications after transaction
            const user = await this.databaseService.user.findUnique({
                where: { id: userId },
                select: { email: true, firstName: true, lastName: true },
            });

            // Notify user
            if (user?.email) {
                await this.emailService.queueEmail({
                    to: user.email,
                    subject: 'Booking Request Received - Drokpa',
                    html: `
                        <p>Dear ${user.firstName} ${user.lastName},</p>
                        <p>Your vehicle booking request has been received successfully.</p>
                        <p><strong>Booking ID:</strong> ${booking.id}</p>
                        <p>The provider will review your request and notify you once it's confirmed.</p>
                        <p>Thank you for choosing Drokpa!</p>
                    `,
                });
            }

            // Notify provider
            if (vehicle.provider.user?.email) {
                await this.emailService.sendBookingRequestNotification(
                    vehicle.provider.user.email,
                    { id: booking.id },
                );
            }

            // Notify all admins
            const adminEmails = await this.adminService.getAdminEmails();
            for (const adminEmail of adminEmails) {
                await this.emailService.queueEmail({
                    to: adminEmail,
                    subject: 'New Vehicle Booking Request - Drokpa',
                    html: `
                        <p>Dear Admin,</p>
                        <p>A new vehicle booking request has been received.</p>
                        <p><strong>Booking ID:</strong> ${booking.id}</p>
                        <p><strong>User:</strong> ${user?.firstName} ${user?.lastName} (${user?.email})</p>
                        <p>Please monitor the booking status.</p>
                    `,
                });
            }

            return booking;
        });
    }

    async createGuideBooking(userId: string, dto: CreateGuideBookingDto) {
        const startDate = new Date(dto.startDate);
        const endDate = new Date(dto.endDate);

        if (endDate <= startDate) {
            throw new BadRequestException('End date must be after start date');
        }

        const guide = await this.databaseService.localGuide.findUnique({
            where: { id: dto.guideId },
            include: {
                provider: {
                    include: {
                        user: true,
                    },
                },
            },
        });

        if (!guide || !guide.isActive) {
            throw new BadRequestException('Guide not available');
        }

        const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const totalPrice = guide.basePricePerDay * days * dto.quantity;

        return this.databaseService.$transaction(async tx => {
            const booking = await tx.booking.create({
                data: {
                    userId,
                    status: BookingStatus.REQUESTED,
                    source: 'ONLINE',
                },
            });

            await tx.bookingItem.create({
                data: {
                    bookingId: booking.id,
                    productType: ProductType.LOCAL_GUIDE,
                    productId: guide.id,
                    startDate,
                    endDate,
                    quantity: dto.quantity,
                    price: totalPrice,
                    permitRequired: false,
                },
            });

            return booking;
        }).then(async (booking) => {
            // Send notifications after transaction
            const user = await this.databaseService.user.findUnique({
                where: { id: userId },
                select: { email: true, firstName: true, lastName: true },
            });

            // Notify user
            if (user?.email) {
                await this.emailService.queueEmail({
                    to: user.email,
                    subject: 'Booking Request Received - Drokpa',
                    html: `
                        <p>Dear ${user.firstName} ${user.lastName},</p>
                        <p>Your local guide booking request has been received successfully.</p>
                        <p><strong>Booking ID:</strong> ${booking.id}</p>
                        <p>The guide will review your request and notify you once it's confirmed.</p>
                        <p>Thank you for choosing Drokpa!</p>
                    `,
                });
            }

            // Notify provider
            if (guide.provider.user?.email) {
                await this.emailService.sendBookingRequestNotification(
                    guide.provider.user.email,
                    { id: booking.id },
                );
            }

            // Notify all admins
            const adminEmails = await this.adminService.getAdminEmails();
            for (const adminEmail of adminEmails) {
                await this.emailService.queueEmail({
                    to: adminEmail,
                    subject: 'New Local Guide Booking Request - Drokpa',
                    html: `
                        <p>Dear Admin,</p>
                        <p>A new local guide booking request has been received.</p>
                        <p><strong>Booking ID:</strong> ${booking.id}</p>
                        <p><strong>User:</strong> ${user?.firstName} ${user?.lastName} (${user?.email})</p>
                        <p>Please monitor the booking status.</p>
                    `,
                });
            }

            return booking;
        });
    }

    async confirmBooking(bookingId: string, providerId: string, dto: ConfirmBookingDto) {
        const booking = await this.databaseService.booking.findUnique({
            where: { id: bookingId },
            include: {
                items: {
                    include: {
                        booking: true,
                    },
                },
                user: true,
            },
        });

        if (!booking) {
            throw new NotFoundException('Booking not found');
        }

        // Verify provider owns the product
        const item = booking.items[0];
        let productProviderId: string | null = null;

        if (item.productType === ProductType.HOMESTAY) {
            // For homestay, productId is actually roomId
            const room = await this.databaseService.homestayRoom.findUnique({
                where: { id: item.productId },
                include: { homestay: true },
            });
            productProviderId = room?.homestay.providerId || null;
        } else if (item.productType === ProductType.VEHICLE) {
            const vehicle = await this.databaseService.vehicle.findUnique({
                where: { id: item.productId },
            });
            productProviderId = vehicle?.providerId || null;
        } else if (item.productType === ProductType.LOCAL_GUIDE) {
            const guide = await this.databaseService.localGuide.findUnique({
                where: { id: item.productId },
            });
            productProviderId = guide?.providerId || null;
        }

        if (productProviderId !== providerId) {
            throw new ForbiddenException('You do not have permission to confirm this booking');
        }

        if (booking.status !== BookingStatus.REQUESTED) {
            throw new BadRequestException('Booking cannot be confirmed in current status');
        }

        // Use transaction for homestay availability updates
        return this.databaseService.$transaction(async tx => {
            // For homestay bookings, reduce availability when confirming
            if (item.productType === ProductType.HOMESTAY && item.startDate && item.endDate) {
                const checkIn = new Date(item.startDate);
                const checkOut = new Date(item.endDate);
                
                const availability = await tx.roomAvailability.findMany({
                    where: {
                        roomId: item.productId,
                        date: {
                            gte: checkIn,
                            lt: checkOut,
                        },
                    },
                });

                // Check availability first
                for (const avail of availability) {
                    if (avail.available < item.quantity) {
                        throw new BadRequestException('Not enough rooms available for confirmation');
                    }
                }

                // Reduce availability for each date
                for (const avail of availability) {
                    await tx.roomAvailability.update({
                        where: { id: avail.id },
                        data: { available: { decrement: item.quantity } },
                    });
                }
            }

            const updatedBooking = await tx.booking.update({
                where: { id: bookingId },
                data: {
                    status: BookingStatus.AWAITING_PAYMENT,
                },
            });

            // Send email to user
            if (booking.user?.email) {
                await this.emailService.queueEmail({
                    to: booking.user.email,
                    subject: 'Booking Confirmed - Payment Required',
                    html: `<p>Your booking has been confirmed. Please proceed with payment.</p><p>Booking ID: ${bookingId}</p>`,
                });
            }

            return updatedBooking;
        });
    }

    async rejectBooking(bookingId: string, providerId: string, dto: RejectBookingDto) {
        const booking = await this.databaseService.booking.findUnique({
            where: { id: bookingId },
            include: {
                items: true,
                user: true,
            },
        });

        if (!booking) {
            throw new NotFoundException('Booking not found');
        }

        // Verify provider owns the product (similar to confirm)
        const item = booking.items[0];
        let productProviderId: string | null = null;

        if (item.productType === ProductType.HOMESTAY) {
            // For homestay, productId is actually roomId
            const room = await this.databaseService.homestayRoom.findUnique({
                where: { id: item.productId },
                include: { homestay: true },
            });
            productProviderId = room?.homestay.providerId || null;
        } else if (item.productType === ProductType.VEHICLE) {
            const vehicle = await this.databaseService.vehicle.findUnique({
                where: { id: item.productId },
            });
            productProviderId = vehicle?.providerId || null;
        } else if (item.productType === ProductType.LOCAL_GUIDE) {
            const guide = await this.databaseService.localGuide.findUnique({
                where: { id: item.productId },
            });
            productProviderId = guide?.providerId || null;
        }

        if (productProviderId !== providerId) {
            throw new ForbiddenException('You do not have permission to reject this booking');
        }

        if (booking.status !== BookingStatus.REQUESTED) {
            throw new BadRequestException('Booking cannot be rejected in current status');
        }

        const updatedBooking = await this.databaseService.booking.update({
            where: { id: bookingId },
            data: {
                status: BookingStatus.REJECTED,
            },
        });

        // Send email to user
        if (booking.user?.email) {
            await this.emailService.queueEmail({
                to: booking.user.email,
                subject: 'Booking Rejected',
                html: `<p>Your booking has been rejected.</p><p>Reason: ${dto.reason}</p><p>Booking ID: ${bookingId}</p>`,
            });
        }

        return updatedBooking;
    }

    async getBooking(bookingId: string, userId?: string, providerId?: string) {
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
                        guests: {
                            include: {
                                permit: true,
                            },
                        },
                        permits: true,
                    },
                },
                payment: true,
            },
        });

        if (!booking) {
            throw new NotFoundException('Booking not found');
        }

        // Verify access
        if (userId && booking.userId !== userId) {
            throw new ForbiddenException('Unauthorized access');
        }

        // Provider access check would go here if needed

        return booking;
    }

    async getMyBookings(userId: string, status?: BookingStatus) {
        return this.databaseService.booking.findMany({
            where: {
                userId,
                ...(status && { status }),
            },
            include: {
                items: {
                    include: {
                        guests: true,
                    },
                },
                payment: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getProviderBookings(providerId: string, status?: BookingStatus) {
        // Get all products owned by provider
        const homestays = await this.databaseService.homestay.findMany({
            where: { providerId },
            select: { id: true },
        });
        const vehicles = await this.databaseService.vehicle.findMany({
            where: { providerId },
            select: { id: true },
        });
        const guides = await this.databaseService.localGuide.findMany({
            where: { providerId },
            select: { id: true },
        });

        const homestayIds = homestays.map(h => h.id);
        const vehicleIds = vehicles.map(v => v.id);
        const guideIds = guides.map(g => g.id);

        return this.databaseService.booking.findMany({
            where: {
                ...(status && { status }),
                items: {
                    some: {
                        OR: [
                            { productType: ProductType.HOMESTAY, productId: { in: homestayIds } },
                            { productType: ProductType.VEHICLE, productId: { in: vehicleIds } },
                            { productType: ProductType.LOCAL_GUIDE, productId: { in: guideIds } },
                        ],
                    },
                },
            },
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
                        guests: true,
                    },
                },
                payment: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }
}
