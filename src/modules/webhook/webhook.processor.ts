import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { WEBHOOK_QUEUE } from 'src/config/constants';
import { DatabaseService } from 'src/services/database/database.service';
import { EmailService } from 'src/services/email/email.service';
import { PaymentStatus, BookingStatus } from 'generated/prisma/enums';

@Processor(WEBHOOK_QUEUE, {
    concurrency: 3,
})
export class WebhookProcessor extends WorkerHost {
    private readonly logger = new Logger(WebhookProcessor.name);

    constructor(
        private readonly databaseService: DatabaseService,
        private readonly emailService: EmailService,
    ) {
        super();
        this.logger.log('WebhookProcessor initialized');
    }

    async process(job: Job<any, any, string>): Promise<any> {
        this.logger.log(`Processing webhook job: ${job.name} with ID: ${job.id}, Data:`, JSON.stringify(job.data));

        try {
            const { eventId } = job.data;

            const event = await this.databaseService.webhookEvent.findUnique({
                where: { providerEventId: eventId },
            });

            if (!event || event.processed) {
                this.logger.log(`Event ${eventId} already processed or not found`);
                return;
            }

            const payload = event.rawBody as any;
            const paymentEntity = payload.payload?.payment?.entity || payload.payload?.payment;

            await this.handleWebhookEvent(event.eventType, paymentEntity, event);

            await this.databaseService.webhookEvent.update({
                where: { providerEventId: eventId },
                data: {
                    processed: true,
                    processedAt: new Date(),
                    paymentId: event.paymentId,
                },
            });
        } catch (error) {
            this.logger.error(`WEBHOOK_QUEUE job ${job.id} (${job.name}) failed:`, error.message);
            this.logger.error('Stack trace:', error.stack);
            throw error;
        }
    }

    private async handleWebhookEvent(eventType: string, paymentEntity: any, event: any) {
        switch (eventType) {
            case 'payment.captured':
                await this.handlePaymentCaptured(paymentEntity);
                break;

            case 'payment.authorized':
                await this.handlePaymentAuthorized(paymentEntity);
                break;

            case 'payment.failed':
                await this.handlePaymentFailed(paymentEntity);
                break;

            case 'payment.refunded':
            case 'refund.processed':
                await this.handlePaymentRefunded(paymentEntity);
                break;

            case 'order.paid':
                await this.handleOrderPaid(paymentEntity);
                break;

            default:
                this.logger.warn(`Unhandled webhook event type: ${eventType}`);
        }
    }

    private async handlePaymentCaptured(paymentEntity: any) {
        const payment = await this.databaseService.payment.findFirst({
            where: { providerPaymentId: paymentEntity.id },
            include: {
                booking: {
                    include: {
                        user: true,
                        items: true,
                    },
                },
            },
        });

        if (!payment) {
            this.logger.warn(`Payment not found for providerPaymentId: ${paymentEntity.id}`);
            return;
        }

        await this.databaseService.$transaction([
            this.databaseService.payment.update({
                where: { id: payment.id },
                data: {
                    status: PaymentStatus.CAPTURED,
                    providerPaymentId: paymentEntity.id,
                },
            }),
            this.databaseService.booking.update({
                where: { id: payment.bookingId },
                data: { status: BookingStatus.CONFIRMED },
            }),
        ]);

        // Send confirmation email
        if (payment.booking.user?.email) {
            await this.emailService.sendBookingConfirmation(
                payment.booking.user.email,
                {
                    id: payment.booking.id,
                    amount: payment.amount,
                },
            );
        }
    }

    private async handlePaymentAuthorized(paymentEntity: any) {
        const payment = await this.databaseService.payment.findFirst({
            where: { providerPaymentId: paymentEntity.id },
        });

        if (payment) {
            await this.databaseService.payment.update({
                where: { id: payment.id },
                data: { status: PaymentStatus.AUTHORIZED },
            });
        }
    }

    private async handlePaymentFailed(paymentEntity: any) {
        const payment = await this.databaseService.payment.findFirst({
            where: { providerPaymentId: paymentEntity.id },
            include: {
                booking: {
                    include: {
                        user: true,
                    },
                },
            },
        });

        if (payment) {
            await this.databaseService.payment.update({
                where: { id: payment.id },
                data: { status: PaymentStatus.FAILED },
            });
        }
    }

    private async handlePaymentRefunded(paymentEntity: any) {
        const payment = await this.databaseService.payment.findFirst({
            where: { providerPaymentId: paymentEntity.id },
            include: {
                refunds: true,
                booking: true,
            },
        });

        if (payment) {
            const refundAmount = paymentEntity.amount / 100; // Convert from paise

            // Check if refund already exists
            const existingRefund = payment.refunds.find(
                (r) => Math.abs(r.amount - refundAmount) < 0.01,
            );

            if (!existingRefund) {
                await this.databaseService.refund.create({
                    data: {
                        paymentId: payment.id,
                        amount: refundAmount,
                        status: 'PROCESSED',
                    },
                });
            }

            // Update payment status if fully refunded
            const totalRefunded = payment.refunds.reduce((sum, r) => sum + r.amount, 0) + refundAmount;
            if (totalRefunded >= payment.amount) {
                await this.databaseService.$transaction([
                    this.databaseService.payment.update({
                        where: { id: payment.id },
                        data: { status: PaymentStatus.REFUNDED },
                    }),
                    this.databaseService.booking.update({
                        where: { id: payment.bookingId },
                        data: { status: BookingStatus.REFUNDED },
                    }),
                ]);
            }
        }
    }

    private async handleOrderPaid(paymentEntity: any) {
        // Order paid event - similar to payment captured
        await this.handlePaymentCaptured(paymentEntity);
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