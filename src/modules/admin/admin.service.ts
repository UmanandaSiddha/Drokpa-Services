import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from 'src/services/database/database.service';
import { EmailService } from 'src/services/email/email.service';
import { PrismaApiFeatures, QueryString } from 'src/utils/apiFeatures';
import { ProviderStatus, PaymentStatus, UserRole, BookingStatus, ProviderType } from 'generated/prisma/enums';
import { AuthService } from '../auth/auth.service';
import { Prisma } from 'generated/prisma/client';

@Injectable()
export class AdminService {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly authService: AuthService,
        private readonly emailService: EmailService,
    ) { }

    // ─────────────────────────────────────────
    // Dashboard
    // ─────────────────────────────────────────

    async getDashboardStats() {
        const [
            totalUsers,
            totalProviders,
            totalBookings,
            totalPayments,
            totalRevenue,
        ] = await Promise.all([
            this.databaseService.user.count(),
            this.databaseService.provider.count(),
            this.databaseService.booking.count(),
            this.databaseService.payment.count({
                where: { status: PaymentStatus.CAPTURED },
            }),
            this.databaseService.payment.aggregate({
                where: { status: PaymentStatus.CAPTURED },
                _sum: { amount: true },
            }),
        ]);

        return {
            totalUsers,
            totalProviders,
            totalBookings,
            totalPayments,
            totalRevenue: totalRevenue._sum.amount ?? 0,
        };
    }

    // ─────────────────────────────────────────
    // Bookings
    // ─────────────────────────────────────────

    async getAllBookings(queryStr: QueryString, status?: BookingStatus) {
        const features = new PrismaApiFeatures<
            Prisma.BookingWhereInput,
            Prisma.BookingInclude,
            Prisma.BookingOrderByWithRelationInput,
            typeof this.databaseService.booking
        >(this.databaseService.booking, queryStr)
            .where({ ...(status && { status }) })
            .filter()
            .sort({ createdAt: 'desc' } as Prisma.BookingOrderByWithRelationInput)
            .include({
                user: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                items: true,
                payment: true,
            })
            .pagination();

        const { results, totalCount } = await features.execute();
        const page = Number(queryStr.page) || 1;
        const limit = Number(queryStr.limit) || 10;

        return {
            data: results,
            meta: {
                total: totalCount,
                page,
                limit,
                totalPages: Math.ceil(totalCount / limit),
            },
        };
    }

    // ─────────────────────────────────────────
    // Tour Booking Admin Actions
    // ─────────────────────────────────────────

    /**
     * Admin confirms a REQUESTED tour booking, transitioning it to AWAITING_PAYMENT.
     * Tours are platform-managed — providers cannot do this step.
     */
    async confirmTourBooking(
        bookingId: string,
        paymentWindowMinutes: number = 30,
    ) {
        const booking = await this.databaseService.booking.findUnique({
            where: { id: bookingId },
            include: {
                items: { select: { productType: true } },
                user: { select: { email: true, firstName: true } },
            },
        });

        if (!booking) throw new NotFoundException('Booking not found');
        if (booking.status !== BookingStatus.REQUESTED) {
            throw new BadRequestException(
                `Booking cannot be confirmed from status: ${booking.status}`,
            );
        }

        const isTourBooking = booking.items.some(
            i => i.productType === ProviderType.TOUR_VENDOR,
        );
        if (!isTourBooking) {
            throw new BadRequestException(
                'This endpoint is only for tour bookings. Use the provider endpoint for other types.',
            );
        }

        const expiresAt = new Date(Date.now() + paymentWindowMinutes * 60 * 1000);

        const updatedBooking = await this.databaseService.booking.update({
            where: { id: bookingId },
            data: {
                status: BookingStatus.AWAITING_PAYMENT,
                confirmedAt: new Date(),
                expiresAt,
            },
        });

        // Notify user to complete payment
        if (booking.user?.email) {
            await this.emailService.queueEmail({
                to: booking.user.email,
                subject: 'Tour Booking Confirmed — Payment Required',
                html: `
                    <p>Dear ${booking.user.firstName},</p>
                    <p>Your tour booking has been confirmed by our team. Please complete your payment within ${paymentWindowMinutes} minutes to secure your spot.</p>
                    <p><strong>Booking ID:</strong> ${bookingId}</p>
                    <p><strong>Payment deadline:</strong> ${expiresAt.toISOString()}</p>
                `,
            }).catch(() => { /* non-fatal */ });
        }

        return updatedBooking;
    }

    /**
     * Admin rejects a REQUESTED tour booking.
     */
    async rejectTourBooking(bookingId: string, reason?: string) {
        const booking = await this.databaseService.booking.findUnique({
            where: { id: bookingId },
            include: {
                items: { select: { productType: true } },
                user: { select: { email: true, firstName: true } },
            },
        });

        if (!booking) throw new NotFoundException('Booking not found');
        if (booking.status !== BookingStatus.REQUESTED) {
            throw new BadRequestException(
                `Booking cannot be rejected from status: ${booking.status}`,
            );
        }

        const isTourBooking = booking.items.some(
            i => i.productType === ProviderType.TOUR_VENDOR,
        );
        if (!isTourBooking) {
            throw new BadRequestException(
                'This endpoint is only for tour bookings.',
            );
        }

        const updatedBooking = await this.databaseService.booking.update({
            where: { id: bookingId },
            data: {
                status: BookingStatus.REJECTED,
                cancellationReason: reason,
                cancelledAt: new Date(),
            },
        });

        if (booking.user?.email) {
            await this.emailService.queueEmail({
                to: booking.user.email,
                subject: 'Tour Booking Rejected',
                html: `
                    <p>Dear ${booking.user.firstName},</p>
                    <p>Unfortunately your tour booking request has been declined.</p>
                    <p><strong>Booking ID:</strong> ${bookingId}</p>
                    ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
                    <p>Please feel free to explore other tour options on Drokpa.</p>
                `,
            }).catch(() => { /* non-fatal */ });
        }

        return updatedBooking;
    }

    // ─────────────────────────────────────────
    // Providers
    // ─────────────────────────────────────────

    async getAllProviders(
        queryStr: QueryString,
        filters?: { status?: ProviderStatus; verified?: boolean },
    ) {
        const features = new PrismaApiFeatures<
            Prisma.ProviderWhereInput,
            Prisma.ProviderInclude,
            Prisma.ProviderOrderByWithRelationInput,
            typeof this.databaseService.provider
        >(this.databaseService.provider, queryStr)
            .where({
                ...(filters?.status && { status: filters.status }),
                ...(filters?.verified !== undefined && { verified: filters.verified }),
            })
            .search(['name'])
            .filter()
            .sort({ createdAt: 'desc' } as Prisma.ProviderOrderByWithRelationInput)
            .include({
                user: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            })
            .pagination();

        const { results, totalCount } = await features.execute();
        const page = Number(queryStr.page) || 1;
        const limit = Number(queryStr.limit) || 10;

        return {
            data: results,
            meta: {
                total: totalCount,
                page,
                limit,
                totalPages: Math.ceil(totalCount / limit),
            },
        };
    }

    async verifyProvider(providerId: string) {
        const provider = await this.databaseService.provider.findUnique({
            where: { id: providerId },
            select: { id: true, userId: true },
        });
        if (!provider) throw new NotFoundException('Provider not found');

        const updated = await this.databaseService.provider.update({
            where: { id: providerId },
            data: {
                verified: true,
                status: ProviderStatus.ACTIVE,
            },
        });

        // Invalidate Redis cache so next request gets fresh roles/provider data
        await this.authService.invalidateUserCache(provider.userId);

        return updated;
    }

    async suspendProvider(providerId: string) {
        const provider = await this.databaseService.provider.findUnique({
            where: { id: providerId },
            select: { id: true, userId: true },
        });
        if (!provider) throw new NotFoundException('Provider not found');

        const updated = await this.databaseService.provider.update({
            where: { id: providerId },
            data: { status: ProviderStatus.SUSPENDED },
        });

        // Invalidate Redis cache — suspended provider should lose access immediately
        await this.authService.invalidateUserCache(provider.userId);

        return updated;
    }

    // ─────────────────────────────────────────
    // Payments
    // ─────────────────────────────────────────

    async getPaymentAnalytics() {
        const [
            totalPayments,
            successfulPayments,
            failedPayments,
            totalRevenue,
            recentPayments,
        ] = await Promise.all([
            this.databaseService.payment.count(),
            this.databaseService.payment.count({
                where: { status: PaymentStatus.CAPTURED },
            }),
            this.databaseService.payment.count({
                where: { status: PaymentStatus.FAILED },
            }),
            this.databaseService.payment.aggregate({
                where: { status: PaymentStatus.CAPTURED },
                _sum: { amount: true },
            }),
            this.databaseService.payment.findMany({
                where: { status: PaymentStatus.CAPTURED },
                take: 10,
                orderBy: { createdAt: 'desc' },
                include: {
                    booking: {
                        include: {
                            user: { select: { id: true, email: true } },
                        },
                    },
                },
            }),
        ]);

        return {
            totalPayments,
            successfulPayments,
            failedPayments,
            successRate:
                totalPayments > 0
                    ? Number(((successfulPayments / totalPayments) * 100).toFixed(2))
                    : 0,
            totalRevenue: totalRevenue._sum.amount ?? 0,
            recentPayments,
        };
    }

    // ─────────────────────────────────────────
    // Users
    // ─────────────────────────────────────────

    async getAllUsers(queryStr: QueryString) {
        const features = new PrismaApiFeatures<
            Prisma.UserWhereInput,
            Prisma.UserInclude,
            Prisma.UserOrderByWithRelationInput,
            typeof this.databaseService.user
        >(this.databaseService.user, queryStr)
            .search(['firstName', 'lastName', 'email'])
            .filter()
            .sort({ createdAt: 'desc' } as Prisma.UserOrderByWithRelationInput)
            .include({
                roles: true,
                provider: { select: { id: true, name: true, status: true, verified: true } },
            })
            .pagination();

        const { results, totalCount } = await features.execute();
        const page = Number(queryStr.page) || 1;
        const limit = Number(queryStr.limit) || 10;

        return {
            data: results,
            meta: {
                total: totalCount,
                page,
                limit,
                totalPages: Math.ceil(totalCount / limit),
            },
        };
    }

    // ─────────────────────────────────────────
    // Internal utility
    // ─────────────────────────────────────────

    /**
     * Returns all admin email addresses — used by services to send admin notifications.
     */
    async getAdminEmails(): Promise<string[]> {
        const adminUsers = await this.databaseService.user.findMany({
            where: {
                roles: { some: { role: UserRole.ADMIN } },
                isDeleted: false,
            },
            select: { email: true },
        });

        return adminUsers.map(u => u.email).filter(Boolean);
    }

    // ─────────────────────────────────────────
    // CancellationPolicy CRUD
    // ─────────────────────────────────────────

    async createCancellationPolicy(data: {
        productType: string;
        productId: string;
        hoursBefore: number;
        refundPct: number;
    }) {
        return this.databaseService.cancellationPolicy.create({ data: data as any });
    }

    async getCancellationPolicies(productId?: string) {
        return this.databaseService.cancellationPolicy.findMany({
            where: productId ? { productId } : undefined,
            orderBy: { hoursBefore: 'asc' },
        });
    }

    async updateCancellationPolicy(
        id: string,
        data: Partial<{
            hoursBefore: number;
            refundPct: number;
        }>,
    ) {
        const policy = await this.databaseService.cancellationPolicy.findUnique({ where: { id } });
        if (!policy) throw new NotFoundException('Cancellation policy not found');

        return this.databaseService.cancellationPolicy.update({ where: { id }, data });
    }

    async deleteCancellationPolicy(id: string) {
        const policy = await this.databaseService.cancellationPolicy.findUnique({ where: { id } });
        if (!policy) throw new NotFoundException('Cancellation policy not found');

        await this.databaseService.cancellationPolicy.delete({ where: { id } });
        return { message: 'Cancellation policy deleted successfully' };
    }
}