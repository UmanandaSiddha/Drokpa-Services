import {
    Injectable,
    Inject,
    BadRequestException,
    InternalServerErrorException,
    Logger,
} from '@nestjs/common';
import { RAZORPAY_CLIENT } from 'src/config/constants';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import Razorpay = require("razorpay");
import { Orders } from 'razorpay/dist/types/orders';
import { Payments } from 'razorpay/dist/types/payments';
import { Refunds } from 'razorpay/dist/types/refunds';

@Injectable()
export class RazorpayService {
    private readonly logger = new Logger(RazorpayService.name);

    constructor(
        @Inject(RAZORPAY_CLIENT) private readonly razorpay: Razorpay | null,
        private readonly config: ConfigService,
    ) { }

    private ensureRazorpayInitialized(): void {
        if (!this.razorpay) {
            throw new InternalServerErrorException('Razorpay is not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables.');
        }
    }

    /* -------------------- ORDERS -------------------- */

    async createOrder(payload: {
        amount: number;
        currency?: string;
        receipt?: string;
        notes?: Record<string, any>;
    }): Promise<Orders.RazorpayOrder> {
        this.ensureRazorpayInitialized();
        
        try {
            if (!payload.amount || payload.amount <= 0) {
                throw new BadRequestException('Amount must be greater than 0');
            }

            return await this.razorpay!.orders.create({
                amount: payload.amount,
                currency: payload.currency ?? 'INR',
                receipt: payload.receipt,
                notes: payload.notes ?? {},
            });
        } catch (err: any) {
            throw new InternalServerErrorException(
                err?.error?.description || 'Failed to create Razorpay order',
            );
        }
    }

    /* -------------------- SIGNATURE VERIFICATION -------------------- */

    verifyPaymentSignature(payload: {
        orderId: string;
        paymentId: string;
        signature: string;
    }): boolean {
        const secret = this.config.get<string>('RAZORPAY_KEY_SECRET');
        if (!secret) {
            throw new InternalServerErrorException('Razorpay secret not configured');
        }

        const hmac = crypto
            .createHmac('sha256', secret)
            .update(`${payload.orderId}|${payload.paymentId}`)
            .digest('hex');

        return hmac === payload.signature;
    }

    /* -------------------- FETCH -------------------- */

    async getOrder(orderId: string): Promise<Orders.RazorpayOrder> {
        this.ensureRazorpayInitialized();
        if (!orderId) throw new BadRequestException('Order ID is required');
        return this.razorpay!.orders.fetch(orderId);
    }

    async getPayment(paymentId: string): Promise<Payments.RazorpayPayment> {
        this.ensureRazorpayInitialized();
        if (!paymentId) throw new BadRequestException('Payment ID is required');
        return this.razorpay!.payments.fetch(paymentId);
    }

    /* -------------------- CAPTURE -------------------- */

    async capturePayment(payload: {
        paymentId: string;
        amount: number;
        currency?: string;
    }): Promise<Payments.RazorpayPayment> {
        this.ensureRazorpayInitialized();
        if (!payload.paymentId || !payload.amount) {
            throw new BadRequestException('Payment ID and amount are required');
        }

        return this.razorpay!.payments.capture(
            payload.paymentId,
            payload.amount,
            payload.currency ?? 'INR',
        );
    }

    /* -------------------- REFUNDS -------------------- */

    async refundPayment(payload: {
        paymentId: string;
        amount?: number;
        notes?: Record<string, any>;
    }): Promise<Refunds.RazorpayRefund> {
        this.ensureRazorpayInitialized();
        if (!payload.paymentId) {
            throw new BadRequestException('Payment ID is required');
        }

        return this.razorpay!.payments.refund(payload.paymentId, {
            amount: payload.amount,
            notes: payload.notes ?? {},
        });
    }

    async getRefund(paymentId: string, refundId: string): Promise<Refunds.RazorpayRefund> {
        this.ensureRazorpayInitialized();
        if (!paymentId || !refundId) {
            throw new BadRequestException('Payment ID and refund ID are required');
        }

        return this.razorpay!.payments.fetchRefund(paymentId, refundId);
    }

    /* -------------------- ORDER PAYMENTS -------------------- */

    async getPaymentsForOrder(orderId: string): Promise<Payments.RazorpayPayment[]> {
        this.ensureRazorpayInitialized();
        if (!orderId) {
            throw new BadRequestException('Order ID is required');
        }

        const payments = await this.razorpay!.orders.fetchPayments(orderId);
        return payments.items ?? [];
    }
}
