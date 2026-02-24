import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/services/database/database.service';
import { EmailService } from 'src/services/email/email.service';
import { PrismaApiFeatures, QueryString } from 'src/utils/apiFeatures';
import { ProviderType } from 'generated/prisma/enums';
import { LoggerService } from 'src/services/logger/logger.service';

@Injectable()
export class ServiceWaitlistService {
    private readonly logger = new LoggerService(ServiceWaitlistService.name);

    constructor(
        private readonly databaseService: DatabaseService,
        private readonly emailService: EmailService,
    ) { }

    /**
     * Join waitlist for a service
     */
    async joinWaitlist(data: {
        email: string;
        name?: string;
        phoneNumber?: string;
        serviceType: ProviderType;
        location?: string;
        metadata?: any;
    }) {
        // Check if already on waitlist for this service type
        const existing = await this.databaseService.serviceWaitlist.findFirst({
            where: {
                email: data.email,
                serviceType: data.serviceType,
            },
        });

        if (existing) {
            throw new BadRequestException('Already joined waitlist for this service');
        }

        const waitlist = await this.databaseService.serviceWaitlist.create({
            data: {
                email: data.email,
                name: data.name ?? null,
                phoneNumber: data.phoneNumber ?? null,
                serviceType: data.serviceType,
                location: data.location ?? null,
                metadata: data.metadata ?? null,
                notified: false,
            },
        });

        this.logger.log(`User ${data.email} joined ${data.serviceType} waitlist`);
        return waitlist;
    }

    /**
     * Get waitlist entries by service type (admin)
     */
    async getWaitlistByService(serviceType: ProviderType, query: QueryString) {
        const apiFeatures = new PrismaApiFeatures(
            this.databaseService.serviceWaitlist,
            query,
        )
            .where({ serviceType } as any)
            .sort({ createdAt: 'desc' } as any)
            .pagination(20);

        const { results, totalCount } = await apiFeatures.execute();
        const limit = Number(query.limit) || 20;
        const page = Number(query.page) || 1;

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

    /**
     * Remove from waitlist
     */
    async removeFromWaitlist(waitlistId: string) {
        const waitlist = await this.databaseService.serviceWaitlist.findUnique({
            where: { id: waitlistId },
        });

        if (!waitlist) {
            throw new NotFoundException('Waitlist entry not found');
        }

        return this.databaseService.serviceWaitlist.delete({
            where: { id: waitlistId },
        });
    }

    /**
     * Notify waitlist users about service availability (admin)
     */
    async notifyWaitlist(serviceType: ProviderType) {
        const waitlist = await this.databaseService.serviceWaitlist.findMany({
            where: {
                serviceType,
                notified: false,
            },
        });

        if (waitlist.length === 0) {
            return { notified: 0 };
        }

        // Send notification emails and mark as notified
        let notified = 0;
        for (const entry of waitlist) {
            try {
                // TODO: Implement email sending when email service method is ready
                // await this.emailService.sendWaitlistNotification(entry.email, {
                //     name: entry.name,
                //     serviceType,
                // });

                // Mark as notified
                await this.databaseService.serviceWaitlist.update({
                    where: { id: entry.id },
                    data: {
                        notified: true,
                        notifiedAt: new Date(),
                    },
                });
                notified++;
            } catch (error) {
                this.logger.error(`Failed to notify ${entry.email}`, error);
            }
        }

        this.logger.log(`Notified ${notified} users from ${serviceType} waitlist`);
        return { notified };
    }

    /**
     * Get waitlist statistics (admin)
     */
    async getWaitlistStats() {
        const stats = await this.databaseService.serviceWaitlist.groupBy({
            by: ['serviceType'],
            _count: {
                _all: true,
            },
        });

        const result = [];
        for (const stat of stats) {
            const notified = await this.databaseService.serviceWaitlist.count({
                where: {
                    serviceType: stat.serviceType,
                    notified: true,
                },
            });

            result.push({
                serviceType: stat.serviceType,
                total: stat._count._all,
                notified,
                pending: stat._count._all - notified,
            });
        }

        return result;
    }
}
