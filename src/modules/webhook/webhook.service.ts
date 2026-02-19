import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DatabaseService } from 'src/services/database/database.service';
import { WEBHOOK_QUEUE } from 'src/config/constants';
import { Prisma } from 'generated/prisma/client';

@Injectable()
export class WebhookService {
    private readonly logger = new Logger(WebhookService.name);

    constructor(
        private readonly databaseService: DatabaseService,
        @InjectQueue(WEBHOOK_QUEUE) private readonly webhookQueue: Queue,
    ) { }

    /**
     * Process incoming Razorpay webhook with atomic idempotency.
     *
     * Idempotency is enforced by the DB unique constraint on providerEventId —
     * we catch P2002 instead of doing a pre-check to avoid the race condition
     * where two concurrent requests both pass a findUnique check before either
     * creates the record.
     */
    async processRazorpayWebhook(
        event: any,
    ): Promise<{ received: boolean; duplicate?: boolean }> {
        const eventId = event.id;
        const eventType = event.event;

        try {
            // Persist event first — durability before queueing
            await this.databaseService.webhookEvent.create({
                data: {
                    provider: 'RAZORPAY',
                    providerEventId: eventId,
                    eventType,
                    rawBody: event,
                },
            });
        } catch (e) {
            // P2002 = unique constraint violation — event already exists
            if (
                e instanceof Prisma.PrismaClientKnownRequestError &&
                e.code === 'P2002'
            ) {
                this.logger.warn(`Duplicate webhook received: ${eventId}`);
                return { received: true, duplicate: true };
            }
            throw e;
        }

        // Enqueue for async processing only after successful persist
        await this.webhookQueue.add(
            'razorpay',
            { eventId },
            {
                attempts: 3,
                backoff: { type: 'exponential', delay: 2000 },
                removeOnComplete: 100,
                removeOnFail: 50,
            },
        );

        this.logger.log(`Webhook ${eventId} (${eventType}) queued for processing`);
        return { received: true };
    }
}