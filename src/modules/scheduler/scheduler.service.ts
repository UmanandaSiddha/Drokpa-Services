import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from 'src/services/database/database.service';
import { BookingStatus, ProviderType } from 'generated/prisma/enums';

@Injectable()
export class SchedulerService {
    private readonly logger = new Logger(SchedulerService.name);

    constructor(private readonly databaseService: DatabaseService) { }

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
}