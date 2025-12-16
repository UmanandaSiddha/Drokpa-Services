import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { WEBHOOK_QUEUE } from 'src/config/constants';
import { DatabaseService } from 'src/services/database/database.service';

@Processor(WEBHOOK_QUEUE, {
    concurrency: 3,
    // settings: {
    //     stalledInterval: 30 * 1000,
    //     maxStalledCount: 1,
    // }
})
export class DeliveryConsumer extends WorkerHost {
    private readonly logger = new Logger(DeliveryConsumer.name);

    constructor(
        private readonly databaseService: DatabaseService
    ) {
        super();
        this.logger.log('DeliveryConsumer initialized');
    }

    async process(job: Job<any, any, string>): Promise<any> {
        this.logger.log(`Processing delivery job: ${job.name} with ID: ${job.id}, Data:`, JSON.stringify(job.data));

        try {
            const { eventId } = job.data;

            const event = await this.databaseService.webhookEvent.findUnique({
                where: { providerEventId: eventId },
            });

            if (!event || event.processed) return;

            const payload = event.rawBody as any;

            switch (event.eventType) {
                case 'payment.captured':
                    await this.databaseService.payment.updateMany({
                        where: { providerPaymentId: payload.payload.payment.entity.id },
                        data: { status: 'CAPTURED' },
                    });
                    break;

                case 'payment.failed':
                    await this.databaseService.payment.updateMany({
                        where: { providerPaymentId: payload.payload.payment.entity.id },
                        data: { status: 'FAILED' },
                    });
                    break;
            }

            await this.databaseService.webhookEvent.update({
                where: { providerEventId: eventId },
                data: {
                    processed: true,
                    processedAt: new Date(),
                },
            });
        } catch (error) {
            this.logger.error(`WEBHOOK_QUEUE job ${job.id} (${job.name}) failed:`, error.message);
            this.logger.error('Stack trace:', error.stack);
            throw error;
        }
    }

    @OnWorkerEvent('active')
    onActive(job: Job) {
        this.logger.log(`🟡 WEBHOOK_QUEUE job ${job.id} (${job.name}) is now ACTIVE`);
    }

    @OnWorkerEvent('completed')
    onCompleted(job: Job, result: any) {
        this.logger.log(`✅ WEBHOOK_QUEUE job ${job.id} (${job.name}) COMPLETED!`);
        if (result) {
            this.logger.debug(`Job result:`, JSON.stringify(result));
        }
    }

    @OnWorkerEvent('failed')
    onFailed(job: Job, err: Error) {
        this.logger.error(`❌ WEBHOOK_QUEUE job ${job.id} (${job.name}) FAILED! Attempt ${job.attemptsMade}/${job.opts.attempts}`);
        this.logger.error(`Error: ${err.message}`);
    }

    @OnWorkerEvent('stalled')
    onStalled(jobId: string) {
        this.logger.warn(`⚠️ WEBHOOK_QUEUE job ${jobId} STALLED`);
    }

    @OnWorkerEvent('error')
    onError(err: Error) {
        this.logger.error('🔴 WEBHOOK_QUEUE worker error:', err.message);
        this.logger.error('WEBHOOK_QUEUE worker error stack:', err.stack);
    }

    @OnWorkerEvent('ready')
    onReady() {
        this.logger.log('🟢 WEBHOOK_QUEUE Worker is ready');
    }
}