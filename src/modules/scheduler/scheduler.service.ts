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
            select: {
                id: true,
                couponId: true, // needed to decrement coupon usage on expiry
                items: true,
            },
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

                // ── Coupon: free up the usage slot now that the booking has expired ──────
                // Done outside the tx so a coupon decrement failure doesn't roll back expiry.
                // updateMany with gt:0 guard ensures currentUses never goes negative.
                if (booking.couponId) {
                    await this.databaseService.coupon.updateMany({
                        where: { id: booking.couponId, currentUses: { gt: 0 } },
                        data: { currentUses: { decrement: 1 } },
                    }).catch(err =>
                        this.logger.error(
                            `Failed to decrement coupon ${booking.couponId} on booking ${booking.id} expiry`,
                            err,
                        ),
                    );
                }

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
                        await this.emailService.queueEmail({
                            to: permit.participant.email,
                            subject: 'Your Drokpa Permit Has Expired',
                            html: `
                                <p>Dear ${permit.participant.fullName ?? 'Valued Traveller'},</p>
                                <p>Your permit (ID: <strong>${permit.id}</strong>) has expired as it has been more than 6 months since approval.</p>
                                <p>If you plan to travel again, please submit a new permit application through the Drokpa platform.</p>
                                <p>Thank you for choosing Drokpa.</p>
                            `,
                        });
                        this.logger.debug(`Permit expiry email sent to ${permit.participant.email}`);
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