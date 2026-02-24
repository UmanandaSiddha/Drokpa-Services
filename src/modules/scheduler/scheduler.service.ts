import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from 'src/services/database/database.service';
import { EmailService } from 'src/services/email/email.service';
import { LoggerService } from 'src/services/logger/logger.service';
import { BookingStatus, ProviderType, PermitStatus } from 'generated/prisma/enums';
import { S3Service } from 'src/modules/s3/s3.service';

@Injectable()
export class SchedulerService {
    private readonly logger = new LoggerService(SchedulerService.name);

    constructor(
        private readonly databaseService: DatabaseService,
        private readonly emailService: EmailService,
        private readonly s3Service: S3Service,
    ) { }

    /**
     * Expires AWAITING_PAYMENT bookings that have passed their payment deadline.
     * Runs every 5 minutes.
     * For homestay bookings, re-increments RoomAvailability so dates open back up.
     */
    @Cron(CronExpression.EVERY_5_MINUTES)
    async expireStaleBookings(): Promise<void> {
        this.logger.log('Running stale booking expiry check...');

        const expiredBookings = await this.databaseService.booking.findMany({
            where: {
                status: BookingStatus.AWAITING_PAYMENT,
                expiresAt: { lt: new Date() },
            },
            include: { items: true },
        });

        if (!expiredBookings.length) return;

        this.logger.log(`Found ${expiredBookings.length} stale booking(s) to expire`);

        for (const booking of expiredBookings) {
            try {
                await this.databaseService.$transaction(async tx => {
                    // Re-increment availability for homestay items
                    for (const item of booking.items) {
                        if (
                            item.productType === ProviderType.HOMESTAY_HOST &&
                            item.startDate &&
                            item.endDate
                        ) {
                            const availability = await tx.roomAvailability.findMany({
                                where: {
                                    roomId: item.productId,
                                    date: { gte: item.startDate, lt: item.endDate },
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
                        }
                    }

                    await tx.booking.update({
                        where: { id: booking.id },
                        data: {
                            status: BookingStatus.EXPIRED,
                            cancelledAt: new Date(),
                        },
                    });
                });

                this.logger.log(`Booking ${booking.id} expired and availability restored`);
            } catch (err) {
                // Log and continue — one failure shouldn't stop other bookings from expiring
                this.logger.error(`Failed to expire booking ${booking.id}`, err);
            }
        }
    }

    /**
     * Expires permits that have passed their validity period.
     * Runs every day at 2:00 AM.
     * Sends notification emails to affected users.
     */
    @Cron('0 2 * * *') // 2:00 AM every day
    async expireStalePermits(): Promise<void> {
        this.logger.log('Running permit expiry check...');

        // Find permits that should be expired (approved date + 6 months < now)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const expiredPermits = await this.databaseService.permit.findMany({
            where: {
                status: { not: PermitStatus.EXPIRED },
                approvedAt: { lt: sixMonthsAgo },
            },
            include: {
                participant: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true
                    },
                },
            },
        });

        if (!expiredPermits.length) {
            this.logger.log('No expired permits found');
            return;
        }

        this.logger.log(`Found ${expiredPermits.length} permit(s) to expire`);

        for (const permit of expiredPermits) {
            try {
                await this.databaseService.permit.update({
                    where: { id: permit.id },
                    data: {
                        status: PermitStatus.EXPIRED,
                        updatedAt: new Date(),
                    },
                });

                // Send expiry notification email if participant info available
                if (permit.participant?.email) {
                    try {
                        // TODO: Implement sendPermitExpiryEmail in EmailService
                        // await this.emailService.sendPermitExpiryEmail(permit.participant.email, {
                        //     name: permit.participant.fullName,
                        //     permitId: permit.id,
                        // });
                        this.logger.debug(`Would send expiry email to ${permit.participant.email}`);
                    } catch (emailError) {
                        this.logger.error(`Failed to send expiry email for permit ${permit.id}`, emailError);
                    }
                }

                this.logger.log(`Permit ${permit.id} expired${permit.participant ? ' for participant ' + permit.participant.id : ''}`);
            } catch (err) {
                this.logger.error(`Failed to expire permit ${permit.id}`, err);
            }
        }
    }

    /**
     * Cleans up expired temporary file uploads.
     * Runs every 6 hours.
     * Deletes files older than 7 days and not marked as used.
     */
    @Cron(CronExpression.EVERY_6_HOURS)
    async cleanupExpiredUploads(): Promise<void> {
        this.logger.log('Running temporary upload cleanup...');

        try {
            const result = await this.s3Service.cleanupExpiredUploads();
            this.logger.log(`Cleaned up ${result.deletedCount} expired uploads`);
        } catch (error) {
            this.logger.error('Failed to cleanup expired uploads', error);
        }
    }
}