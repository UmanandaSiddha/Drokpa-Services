import {
    Injectable,
    Inject,
    BadRequestException,
    InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RAZORPAY_CLIENT } from 'src/config/constants';
import { LoggerService } from '../logger/logger.service';
import * as crypto from 'crypto';
import Razorpay = require('razorpay');
import { Orders } from 'razorpay/dist/types/orders';
import { Payments } from 'razorpay/dist/types/payments';
import { Refunds } from 'razorpay/dist/types/refunds';

@Injectable()
export class RazorpayService {
    private readonly logger = new LoggerService(RazorpayService.name);

    constructor(
        @Inject(RAZORPAY_CLIENT) private readonly razorpay: Razorpay | null,
        private readonly config: ConfigService,
    ) { }

    // ─────────────────────────────────────────
    // Guard
    // ─────────────────────────────────────────

    private ensureInitialized(): void {
        if (!this.razorpay) {
            throw new InternalServerErrorException(
                'Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.',
            );
        }
    }

    /**
     * Wraps a Razorpay SDK call, catches SDK-level errors, and re-throws
     * as InternalServerErrorException with the Razorpay error description.
     */
    private async call<T>(operation: string, fn: () => Promise<T>): Promise<T> {
        try {
            return await fn();
        } catch (err: any) {
            const description =
                err?.error?.description ??
                err?.message ??
                `Razorpay ${operation} failed`;
            this.logger.error(`[Razorpay] ${operation} failed`, JSON.stringify({
                description,
                code: err?.error?.code,
                raw: err?.error,
            }));
            throw new InternalServerErrorException(description);
        }
    }

    // ─────────────────────────────────────────
    // Orders
    // ─────────────────────────────────────────

    async createOrder(payload: {
        amount: number; // in paise
        currency?: string;
        receipt?: string;
        notes?: Record<string, any>;
    }): Promise<Orders.RazorpayOrder> {
        this.ensureInitialized();

        // Validate before the network call — not inside try/catch so
        // BadRequestException is never swallowed by the error handler
        if (!payload.amount || payload.amount <= 0) {
            throw new BadRequestException('Order amount must be greater than 0');
        }

        return this.call('createOrder', () =>
            this.razorpay!.orders.create({
                amount: payload.amount,
                currency: payload.currency ?? 'INR',
                receipt: payload.receipt,
                notes: payload.notes ?? {},
            }),
        );
    }

    async getOrder(orderId: string): Promise<Orders.RazorpayOrder> {
        this.ensureInitialized();
        if (!orderId) throw new BadRequestException('Order ID is required');

        return this.call('getOrder', () => this.razorpay!.orders.fetch(orderId));
    }

    async getPaymentsForOrder(orderId: string): Promise<Payments.RazorpayPayment[]> {
        this.ensureInitialized();
        if (!orderId) throw new BadRequestException('Order ID is required');

        return this.call('getPaymentsForOrder', async () => {
            const payments = await this.razorpay!.orders.fetchPayments(orderId);
            return payments.items ?? [];
        });
    }

    // ─────────────────────────────────────────
    // Payments
    // ─────────────────────────────────────────

    async getPayment(paymentId: string): Promise<Payments.RazorpayPayment> {
        this.ensureInitialized();
        if (!paymentId) throw new BadRequestException('Payment ID is required');

        return this.call('getPayment', () => this.razorpay!.payments.fetch(paymentId));
    }

    /**
     * Explicitly captures an authorized payment.
     *
     * NOTE: Only required when your Razorpay account is set to manual capture mode.
     * If auto-capture is enabled (default), Razorpay captures automatically and this
     * method is not needed. Check your Razorpay dashboard settings before calling this.
     */
    async capturePayment(payload: {
        paymentId: string;
        amount: number; // in paise
        currency?: string;
    }): Promise<Payments.RazorpayPayment> {
        this.ensureInitialized();

        if (!payload.paymentId) throw new BadRequestException('Payment ID is required');
        if (!payload.amount || payload.amount <= 0) {
            throw new BadRequestException('Capture amount must be greater than 0');
        }

        return this.call('capturePayment', () =>
            this.razorpay!.payments.capture(
                payload.paymentId,
                payload.amount,
                payload.currency ?? 'INR',
            ),
        );
    }

    // ─────────────────────────────────────────
    // Refunds
    // ─────────────────────────────────────────

    async refundPayment(payload: {
        paymentId: string;
        amount?: number; // in paise; omit for full refund
        notes?: Record<string, any>;
    }): Promise<Refunds.RazorpayRefund> {
        this.ensureInitialized();
        if (!payload.paymentId) throw new BadRequestException('Payment ID is required');

        return this.call('refundPayment', () =>
            this.razorpay!.payments.refund(payload.paymentId, {
                amount: payload.amount,
                notes: payload.notes ?? {},
            }),
        );
    }

    async getRefund(paymentId: string, refundId: string): Promise<Refunds.RazorpayRefund> {
        this.ensureInitialized();
        if (!paymentId) throw new BadRequestException('Payment ID is required');
        if (!refundId) throw new BadRequestException('Refund ID is required');

        return this.call('getRefund', () =>
            this.razorpay!.payments.fetchRefund(paymentId, refundId),
        );
    }

    // ─────────────────────────────────────────
    // Signature Verification
    // ─────────────────────────────────────────

    verifyPaymentSignature(payload: {
        orderId: string;
        paymentId: string;
        signature: string;
    }): boolean {
        const secret = this.config.get<string>('RAZORPAY_KEY_SECRET');
        if (!secret) {
            throw new InternalServerErrorException('RAZORPAY_KEY_SECRET is not configured');
        }

        const hmac = crypto
            .createHmac('sha256', secret)
            .update(`${payload.orderId}|${payload.paymentId}`)
            .digest('hex');

        return hmac === payload.signature;
    }
}