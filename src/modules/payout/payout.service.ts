import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from 'src/services/database/database.service';
import { PrismaApiFeatures, QueryString } from 'src/utils/apiFeatures';
import { PayoutStatus, BookingStatus, PaymentStatus } from 'generated/prisma/enums';
import { Prisma } from 'generated/prisma/client';
import { CreatePayoutDto } from './dto/create-payout.dto';

@Injectable()
export class PayoutService {
    constructor(private readonly databaseService: DatabaseService) { }

    // ─────────────────────────────────────────
    // Create payout record (Admin)
    // Called after a booking is COMPLETED to record what is owed to the provider
    // ─────────────────────────────────────────

    async createPayout(dto: CreatePayoutDto) {
        // Validate that the booking item exists
        const bookingItem = await this.databaseService.bookingItem.findUnique({
            where: { id: dto.bookingItemId },
            include: {
                booking: {
                    select: {
                        id: true,
                        status: true,
                        payment: { select: { id: true, status: true, amount: true } },
                    },
                },
            },
        });

        if (!bookingItem) throw new NotFoundException('Booking item not found');
        if (!bookingItem.booking) throw new NotFoundException('Booking not found');

        const booking = bookingItem.booking;

        if (booking.status !== BookingStatus.COMPLETED) {
            throw new BadRequestException(
                'Payouts can only be created for completed bookings',
            );
        }

        // Check that payment exists and is captured
        const payment = await this.databaseService.payment.findFirst({
            where: { bookingId: booking.id, status: PaymentStatus.CAPTURED },
            select: { id: true },
        });

        if (!payment) {
            throw new BadRequestException(
                'Payout requires a captured payment on the booking',
            );
        }

        // Prevent duplicate payout for the same booking item
        const existing = await this.databaseService.providerPayout.findFirst({
            where: { bookingItemId: dto.bookingItemId },
            select: { id: true },
        });
        if (existing) {
            throw new BadRequestException(
                'A payout record already exists for this booking item',
            );
        }

        const provider = await this.databaseService.provider.findUnique({
            where: { id: dto.providerId },
            select: { id: true },
        });
        if (!provider) throw new NotFoundException('Provider not found');

        return this.databaseService.providerPayout.create({
            data: {
                bookingItemId: dto.bookingItemId,
                providerId: dto.providerId,
                paymentId: payment.id,
                amount: dto.amount,
                platformFee: dto.platformFee ?? 0,
                netAmount: dto.amount - (dto.platformFee ?? 0),
                periodStart: dto.periodStart,
                periodEnd: dto.periodEnd,
                status: PayoutStatus.PENDING,
            },
            include: {
                provider: { select: { id: true, name: true } },
                bookingItem: { select: { id: true, bookingId: true } },
            },
        });
    }

    // ─────────────────────────────────────────
    // Mark payout as processing (Admin)
    // When admin initiates bank transfer
    // ─────────────────────────────────────────

    async markProcessing(payoutId: string) {
        const payout = await this.databaseService.providerPayout.findUnique({
            where: { id: payoutId },
            select: { id: true, status: true },
        });
        if (!payout) throw new NotFoundException('Payout not found');

        if (payout.status !== PayoutStatus.PENDING) {
            throw new BadRequestException(
                `Cannot mark as processing from status: ${payout.status}`,
            );
        }

        // Since PayoutStatus enum only has PENDING, PAID, FAILED,
        // we keep it as PENDING until it's actually PAID.
        // This is a placeholder for future workflow states.
        // For now, just update the timestamp.
        return this.databaseService.providerPayout.update({
            where: { id: payoutId },
            data: {
                updatedAt: new Date(),
            },
        });
    }

    // ─────────────────────────────────────────
    // Mark payout as completed (Admin)
    // After bank transfer confirmed
    // ─────────────────────────────────────────

    async markCompleted(payoutId: string) {
        const payout = await this.databaseService.providerPayout.findUnique({
            where: { id: payoutId },
            select: { id: true, status: true },
        });
        if (!payout) throw new NotFoundException('Payout not found');

        if (payout.status !== PayoutStatus.PENDING) {
            throw new BadRequestException(
                `Cannot mark as completed from status: ${payout.status}`,
            );
        }

        return this.databaseService.providerPayout.update({
            where: { id: payoutId },
            data: {
                status: PayoutStatus.PAID,
                updatedAt: new Date(),
            },
        });
    }

    // ─────────────────────────────────────────
    // Mark payout as failed (Admin)
    // ─────────────────────────────────────────

    async markFailed(payoutId: string, reason?: string) {
        const payout = await this.databaseService.providerPayout.findUnique({
            where: { id: payoutId },
            select: { id: true, status: true },
        });
        if (!payout) throw new NotFoundException('Payout not found');

        if (payout.status === PayoutStatus.PAID) {
            throw new BadRequestException('Cannot fail a completed payout');
        }

        // Note: Consider adding a 'notes' or 'failureReason' field to ProviderPayout schema
        // for storing failure details. For now, we only update the status.
        return this.databaseService.providerPayout.update({
            where: { id: payoutId },
            data: {
                status: PayoutStatus.FAILED,
                updatedAt: new Date(),
            },
        });
    }

    // ─────────────────────────────────────────
    // Get all payouts (Admin, paginated)
    // ─────────────────────────────────────────

    async getAllPayouts(queryStr: QueryString, status?: PayoutStatus) {
        const features = new PrismaApiFeatures<
            Prisma.ProviderPayoutWhereInput,
            Prisma.ProviderPayoutInclude,
            Prisma.ProviderPayoutOrderByWithRelationInput,
            typeof this.databaseService.providerPayout
        >(this.databaseService.providerPayout, queryStr)
            .where({ ...(status && { status }) })
            .filter()
            .sort({ createdAt: 'desc' } as Prisma.ProviderPayoutOrderByWithRelationInput)
            .include({
                provider: { select: { id: true, name: true } },
                bookingItem: {
                    select: {
                        id: true,
                        booking: { select: { id: true, status: true } },
                    },
                },
            })
            .pagination();

        const { results, totalCount } = await features.execute();
        const page = Number(queryStr.page) || 1;
        const limit = Number(queryStr.limit) || 10;

        return {
            data: results,
            meta: { total: totalCount, page, limit, totalPages: Math.ceil(totalCount / limit) },
        };
    }

    // ─────────────────────────────────────────
    // Get payouts for a provider (Admin or Provider)
    // ─────────────────────────────────────────

    async getProviderPayouts(
        providerId: string,
        queryStr: QueryString,
        requestingProviderId?: string,
    ) {
        // If a provider is requesting, they can only see their own payouts
        if (requestingProviderId && requestingProviderId !== providerId) {
            throw new ForbiddenException('You can only view your own payouts');
        }

        const features = new PrismaApiFeatures<
            Prisma.ProviderPayoutWhereInput,
            Prisma.ProviderPayoutInclude,
            Prisma.ProviderPayoutOrderByWithRelationInput,
            typeof this.databaseService.providerPayout
        >(this.databaseService.providerPayout, queryStr)
            .where({ providerId })
            .sort({ createdAt: 'desc' } as Prisma.ProviderPayoutOrderByWithRelationInput)
            .include({
                bookingItem: {
                    select: {
                        id: true,
                        booking: { select: { id: true, status: true, createdAt: true } },
                    },
                },
            })
            .pagination();

        const { results, totalCount } = await features.execute();
        const page = Number(queryStr.page) || 1;
        const limit = Number(queryStr.limit) || 10;

        // Also return aggregate stats
        const stats = await this.databaseService.providerPayout.aggregate({
            where: { providerId },
            _sum: { netAmount: true },
            _count: { id: true },
        });

        const completedStats = await this.databaseService.providerPayout.aggregate({
            where: { providerId, status: PayoutStatus.PAID },
            _sum: { netAmount: true },
        });

        return {
            data: results,
            meta: { total: totalCount, page, limit, totalPages: Math.ceil(totalCount / limit) },
            summary: {
                totalPayouts: stats._count.id,
                totalOwed: stats._sum.netAmount ?? 0,
                totalPaid: completedStats._sum.netAmount ?? 0,
            },
        };
    }

    // ─────────────────────────────────────────
    // Get my payouts (Provider)
    // ─────────────────────────────────────────

    async getMyPayouts(providerId: string, queryStr: QueryString) {
        return this.getProviderPayouts(providerId, queryStr, providerId);
    }

    // ─────────────────────────────────────────
    // Get single payout
    // ─────────────────────────────────────────

    async getPayout(id: string, requestingProviderId?: string) {
        const payout = await this.databaseService.providerPayout.findUnique({
            where: { id },
            include: {
                provider: { select: { id: true, name: true } },
                bookingItem: {
                    select: {
                        id: true,
                        booking: {
                            select: {
                                id: true,
                                status: true,
                                createdAt: true,
                                payment: { select: { amount: true, status: true } },
                            },
                        },
                    },
                },
                payment: { select: { amount: true, status: true } },
            },
        });
        if (!payout) throw new NotFoundException('Payout not found');

        // Provider can only view their own payout
        if (requestingProviderId && payout.providerId !== requestingProviderId) {
            throw new ForbiddenException('You do not have access to this payout');
        }

        return payout;
    }
}