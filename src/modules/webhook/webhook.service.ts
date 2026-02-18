import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DatabaseService } from 'src/services/database/database.service';
import { WEBHOOK_QUEUE } from 'src/config/constants';

@Injectable()
export class WebhookService {
    private readonly logger = new Logger(WebhookService.name);

    constructor(
        private readonly databaseService: DatabaseService,
        @InjectQueue(WEBHOOK_QUEUE) private readonly webhookQueue: Queue,
    ) { }

    /**
     * Process incoming webhook event with idempotency check
     */
    async processRazorpayWebhook(event: any): Promise<{ received: boolean; duplicate?: boolean }> {
        const eventId = event.id;
        const eventType = event.event;

        // IDEMPOTENCY CHECK - Prevent duplicate processing
        const alreadyExists = await this.databaseService.webhookEvent.findUnique({
            where: { providerEventId: eventId },
        });

        if (alreadyExists) {
            this.logger.warn(`Duplicate webhook received: ${eventId}`);
            return { received: true, duplicate: true };
        }

        // Persist event FIRST (critical for durability)
        await this.databaseService.webhookEvent.create({
            data: {
                provider: 'RAZORPAY',
                providerEventId: eventId,
                eventType,
                rawBody: event,
            },
        });

        // Enqueue for async processing
        await this.webhookQueue.add('razorpay', {
            eventId,
        });

        this.logger.log(`Webhook ${eventId} (${eventType}) queued for processing`);

        return { received: true };
    }
}
