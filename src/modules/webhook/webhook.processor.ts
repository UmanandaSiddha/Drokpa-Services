import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { LoggerService } from 'src/services/logger/logger.service';
import { WEBHOOK_QUEUE } from 'src/config/constants';
import { DatabaseService } from 'src/services/database/database.service';
import { EmailService } from 'src/services/email/email.service';
import { PaymentStatus, BookingStatus, RefundStatus } from 'generated/prisma/enums';

// ─────────────────────────────────────────
// Job data shape — no more `any`
// ─────────────────────────────────────────
interface WebhookJobData {
    eventId: string;
}

@Processor(WEBHOOK_QUEUE, { concurrency: 3 })
export class WebhookProcessor extends WorkerHost {
    private readonly logger = new LoggerService(WebhookProcessor.name);

    constructor(
        private readonly databaseService: DatabaseService,
        private readonly emailService: EmailService,
    ) {
        super();
        this.logger.log('WebhookProcessor initialized');
    }

    // ─────────────────────────────────────────
    // Main entry point
    // ─────────────────────────────────────────

    async process(job: Job<WebhookJobData>): Promise<void> {
        this.logger.log(
            `Processing webhook job: ${job.name} | ID: ${job.id} | Data: ${JSON.stringify(job.data)}`,
        );

        const { eventId } = job.data;

        const event = await this.databaseService.webhookEvent.findUnique({
            where: { providerEventId: eventId },
        });

        if (!event) {
            this.logger.warn(`Event ${eventId} not found — skipping`);
            return;
        }

        if (event.processed) {
            this.logger.log(`Event ${eventId} already processed — skipping`);
            return;
        }

        const payload = event.rawBody as any;
        const paymentEntity =
            payload.payload?.payment?.entity ?? payload.payload?.payment;

        // Wrap handler + mark-processed in a single transaction —
        // prevents reprocessing if the update fails after a successful handler
        await this.databaseService.$transaction(async tx => {
            await this.handleWebhookEvent(event.eventType, paymentEntity);

            await tx.webhookEvent.update({
                where: { providerEventId: eventId },
                data: {
                    processed: true,
                    processedAt: new Date(),
                },
            });
        });
    }

    // ─────────────────────────────────────────
    // Event router
    // ─────────────────────────────────────────

    private async handleWebhookEvent(
        eventType: string,
        paymentEntity: any,
    ): Promise<void> {
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
                // order.paid is semantically equivalent to payment.captured
                await this.handlePaymentCaptured(paymentEntity);
                break;

            default:
                this.logger.warn(`Unhandled webhook event type: ${eventType}`);
        }
    }

    // ─────────────────────────────────────────
    // Handlers
    // ─────────────────────────────────────────

    private async handlePaymentCaptured(paymentEntity: any): Promise<void> {
        const payment = await this.databaseService.payment.findFirst({
            where: { providerPaymentId: paymentEntity.id },
            include: {
                booking: {
                    include: {
                        user: { select: { email: true, firstName: true, lastName: true } },
                    },
                },
            },
        });

        if (!payment) {
            this.logger.warn(
                `Payment not found for providerPaymentId: ${paymentEntity.id}`,
            );
            return;
        }

        await this.databaseService.$transaction([
            this.databaseService.payment.update({
                where: { id: payment.id },
                data: { status: PaymentStatus.CAPTURED },
            }),
            this.databaseService.booking.update({
                where: { id: payment.bookingId },
                data: {
                    status: BookingStatus.CONFIRMED,
                    // Record the amount paid — keeps paidAmount in sync via webhook path too
                    paidAmount: payment.amount,
                },
            }),
        ]);

        if (payment.booking.user?.email) {
            await this.emailService
                .sendBookingConfirmation(payment.booking.user.email, {
                    id: payment.booking.id,
                    amount: payment.amount,
                })
                .catch(err =>
                    this.logger.error('Failed to send booking confirmation email', err),
                );
        }
    }

    private async handlePaymentAuthorized(paymentEntity: any): Promise<void> {
        const payment = await this.databaseService.payment.findFirst({
            where: { providerPaymentId: paymentEntity.id },
            select: { id: true },
        });

        if (!payment) {
            this.logger.warn(
                `Payment not found for providerPaymentId: ${paymentEntity.id}`,
            );
            return;
        }

        await this.databaseService.payment.update({
            where: { id: payment.id },
            data: { status: PaymentStatus.AUTHORIZED },
        });
    }

    private async handlePaymentFailed(paymentEntity: any): Promise<void> {
        const payment = await this.databaseService.payment.findFirst({
            where: { providerPaymentId: paymentEntity.id },
            include: {
                booking: {
                    include: {
                        user: { select: { email: true, firstName: true } },
                    },
                },
            },
        });

        if (!payment) {
            this.logger.warn(
                `Payment not found for providerPaymentId: ${paymentEntity.id}`,
            );
            return;
        }

        // Update both payment and booking atomically
        await this.databaseService.$transaction([
            this.databaseService.payment.update({
                where: { id: payment.id },
                data: { status: PaymentStatus.FAILED },
            }),
            this.databaseService.booking.update({
                where: { id: payment.bookingId },
                data: { status: BookingStatus.PAYMENT_FAILED },
            }),
        ]);

        // Notify user so they can retry payment
        if (payment.booking.user?.email) {
            await this.emailService
                .queueEmail({
                    to: payment.booking.user.email,
                    subject: 'Payment Failed — Action Required',
                    html: `
                        <p>Dear ${payment.booking.user.firstName},</p>
                        <p>Your payment for booking <strong>${payment.bookingId}</strong> has failed.</p>
                        <p>Please log in and retry your payment to confirm your booking.</p>
                        <p>If you need help, contact our support team.</p>
                    `,
                })
                .catch(err =>
                    this.logger.error('Failed to send payment failure email', err),
                );
        }
    }

    private async handlePaymentRefunded(paymentEntity: any): Promise<void> {
        const payment = await this.databaseService.payment.findFirst({
            where: { providerPaymentId: paymentEntity.id },
            include: { booking: true },
        });

        if (!payment) {
            this.logger.warn(
                `Payment not found for providerPaymentId: ${paymentEntity.id}`,
            );
            return;
        }

        const refundAmount = paymentEntity.amount / 100; // paise → rupees

        // Match by providerRefundId — amount matching fails for same-amount partial refunds
        const providerRefundId: string =
            paymentEntity.refund_id ?? paymentEntity.id;

        const existingRefund = await this.databaseService.refund.findFirst({
            where: { providerRefundId },
        });

        if (!existingRefund) {
            await this.databaseService.refund.create({
                data: {
                    paymentId: payment.id,
                    amount: refundAmount,
                    status: RefundStatus.PROCESSED,
                    providerRefundId,
                },
            });
        }

        // Aggregate from DB — stale in-memory data causes incorrect totals
        const totalRefundedResult = await this.databaseService.refund.aggregate({
            where: {
                paymentId: payment.id,
                status: { not: RefundStatus.FAILED },
            },
            _sum: { amount: true },
        });

        const totalRefunded = totalRefundedResult._sum.amount ?? 0;

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

            this.logger.log(
                `Payment ${payment.id} fully refunded. Booking ${payment.bookingId} marked REFUNDED.`,
            );
        }
    }

    // ─────────────────────────────────────────
    // Worker event hooks
    // ─────────────────────────────────────────

    @OnWorkerEvent('active')
    onActive(job: Job) {
        this.logger.log(`🟡 Job ${job.id} (${job.name}) ACTIVE`);
    }

    @OnWorkerEvent('completed')
    onCompleted(job: Job) {
        this.logger.log(`✅ Job ${job.id} (${job.name}) COMPLETED`);
    }

    @OnWorkerEvent('failed')
    onFailed(job: Job, err: Error) {
        this.logger.error(
            `❌ Job ${job.id} (${job.name}) FAILED | Attempt ${job.attemptsMade}/${job.opts.attempts} | ${err.message}`,
        );
    }

    @OnWorkerEvent('stalled')
    onStalled(jobId: string) {
        this.logger.warn(`⚠️ Job ${jobId} STALLED`);
    }

    @OnWorkerEvent('error')
    onError(err: Error) {
        this.logger.error(`🔴 Worker error: ${err.message}`, err.stack);
    }

    @OnWorkerEvent('ready')
    onReady() {
        this.logger.log('🟢 Worker ready');
    }
}