import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/services/database/database.service';
import { ProviderStatus } from 'generated/prisma/enums';

@Injectable()
export class AdminService {
    constructor(
        private readonly databaseService: DatabaseService,
    ) { }

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
                where: { status: 'CAPTURED' },
            }),
            this.databaseService.payment.aggregate({
                where: { status: 'CAPTURED' },
                _sum: { amount: true },
            }),
        ]);

        return {
            totalUsers,
            totalProviders,
            totalBookings,
            totalPayments,
            totalRevenue: totalRevenue._sum.amount || 0,
        };
    }

    async getAllBookings(filters?: { status?: string }) {
        return this.databaseService.booking.findMany({
            where: {
                ...(filters?.status && { status: filters.status as any }),
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
                items: true,
                payment: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getAllProviders(filters?: { status?: ProviderStatus; verified?: boolean }) {
        return this.databaseService.provider.findMany({
            where: {
                ...(filters?.status && { status: filters.status }),
                ...(filters?.verified !== undefined && { verified: filters.verified }),
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
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async verifyProvider(providerId: string) {
        return this.databaseService.provider.update({
            where: { id: providerId },
            data: {
                verified: true,
                status: ProviderStatus.ACTIVE,
            },
        });
    }

    async suspendProvider(providerId: string) {
        return this.databaseService.provider.update({
            where: { id: providerId },
            data: {
                status: ProviderStatus.SUSPENDED,
            },
        });
    }

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
                where: { status: 'CAPTURED' },
            }),
            this.databaseService.payment.count({
                where: { status: 'FAILED' },
            }),
            this.databaseService.payment.aggregate({
                where: { status: 'CAPTURED' },
                _sum: { amount: true },
            }),
            this.databaseService.payment.findMany({
                where: { status: 'CAPTURED' },
                take: 10,
                orderBy: { createdAt: 'desc' },
                include: {
                    booking: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    email: true,
                                },
                            },
                        },
                    },
                },
            }),
        ]);

        return {
            totalPayments,
            successfulPayments,
            failedPayments,
            successRate: totalPayments > 0 ? (successfulPayments / totalPayments) * 100 : 0,
            totalRevenue: totalRevenue._sum.amount || 0,
            recentPayments,
        };
    }

    async getAllUsers() {
        return this.databaseService.user.findMany({
            include: {
                roles: true,
                provider: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Get all admin email addresses for notifications
     */
    async getAdminEmails(): Promise<string[]> {
        const adminUsers = await this.databaseService.user.findMany({
            where: {
                roles: {
                    some: {
                        role: 'ADMIN',
                    },
                },
            },
            select: {
                email: true,
            },
        });

        return adminUsers.map(user => user.email).filter(email => !!email);
    }
}
