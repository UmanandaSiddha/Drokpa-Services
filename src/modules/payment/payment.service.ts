import {
    Injectable,
    BadRequestException,
    NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from 'src/services/database/database.service';
import { RazorpayService } from 'src/services/razorpay/razorpay.service';
import { LoggerService } from 'src/services/logger/logger.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { CreateRefundDto } from './dto/refund.dto';
import {
    PaymentStatus,
    PaymentProvider,
    BookingStatus,
    RefundStatus,
} from 'generated/prisma/enums';

@Injectable()
export class PaymentService {
    private readonly logger = new LoggerService(PaymentService.name);

    constructor(
        private readonly databaseService: DatabaseService,
        private readonly razorpayService: RazorpayService,
        private readonly config: ConfigService,
    ) { }

    // ─────────────────────────────────────────
    // Create Payment (Razorpay order initiation)
    // ─────────────────────────────────────────

    async createPayment(dto: CreatePaymentDto, userId: string) {
        const booking = await this.databaseService.booking.findFirst({
            where: {
                id: dto.bookingId,
                userId,
                status: BookingStatus.AWAITING_PAYMENT,
            },
            include: { items: true },
        });

        if (!booking) {
            throw new NotFoundException('Booking not found or not ready for payment');
        }

        // Check payment window hasn't expired
        if (booking.expiresAt && booking.expiresAt < new Date()) {
            throw new BadRequestException(
                'Booking payment window has expired. Please start a new booking.',
            );
        }

        // Derive total from booking items — never trust client-sent amount blindly
        const totalAmount = booking.items.reduce((sum, item) => sum + item.totalAmount, 0);

        if (dto.amount !== totalAmount) {
            throw new BadRequestException(
                `Payment amount ₹${dto.amount} does not match booking total ₹${totalAmount}`,
            );
        }

        const order = await this.razorpayService.createOrder({
            amount: dto.amount * 100, // paise
            currency: dto.currency ?? 'INR',
            receipt: dto.bookingId,
            notes: {
                bookingId: dto.bookingId,
                userId,
                ...(dto.notes && { notes: dto.notes }),
            },
        });

        const payment = await this.databaseService.payment.create({
            data: {
                bookingId: dto.bookingId,
                amount: dto.amount,
                currency: dto.currency ?? 'INR',
                provider: PaymentProvider.RAZORPAY,
                status: PaymentStatus.CREATED,
                providerOrderId: order.id,
                notes: dto.notes,
            },
        });

        return {
            paymentId: payment.id,
            orderId: order.id,
            amount: Number(order.amount) / 100, // back to rupees for client
            currency: order.currency,
            key: this.config.get<string>('RAZORPAY_KEY_ID'),
        };
    }

    // ─────────────────────────────────────────
    // Verify Payment (post-checkout callback)
    // ─────────────────────────────────────────

    async verifyPayment(dto: VerifyPaymentDto, userId: string) {
        // 1. Verify Razorpay signature first — cheapest check, no DB needed
        const isValid = this.razorpayService.verifyPaymentSignature({
            orderId: dto.orderId,
            paymentId: dto.paymentId,
            signature: dto.signature,
        });

        if (!isValid) {
            throw new BadRequestException('Invalid payment signature');
        }

        // 2. Find payment + booking
        const payment = await this.databaseService.payment.findFirst({
            where: {
                providerOrderId: dto.orderId,
                booking: { userId },
            },
            include: { booking: true },
        });

        if (!payment) {
            throw new NotFoundException('Payment record not found');
        }

        // 3. Guard against double-processing
        if (payment.booking.status !== BookingStatus.AWAITING_PAYMENT) {
            throw new BadRequestException(
                'Booking is not in a payable state. It may have already been confirmed or cancelled.',
            );
        }

        if (payment.status === PaymentStatus.CAPTURED) {
            throw new BadRequestException('Payment has already been captured');
        }

        // 4. Fetch live payment state from Razorpay
        const razorpayPayment = await this.razorpayService.getPayment(dto.paymentId);
        const isCaptured = razorpayPayment.status === 'captured';

        // 5. Build payment update payload with correct field mappings
        const paymentUpdateData = {
            providerPaymentId: dto.paymentId,
            status: isCaptured ? PaymentStatus.CAPTURED : PaymentStatus.AUTHORIZED,
            capturedAt: isCaptured ? new Date() : undefined,
            method: razorpayPayment.method as any,

            // Card details
            ...(razorpayPayment.card && {
                cardLast4: razorpayPayment.card.last4,
                cardNetwork: razorpayPayment.card.network,
                cardBank: razorpayPayment.card.issuer,
            }),

            // UPI details — vpa is the UPI ID; acquirer_data.upi_transaction_id is the txn ref
            ...(razorpayPayment.vpa && {
                upiVpa: razorpayPayment.vpa,
            }),

            // Netbanking — bank is the bank code (e.g. "HDFC"), no separate display name from Razorpay
            ...(razorpayPayment.bank && {
                bankCode: razorpayPayment.bank,
                bankName: razorpayPayment.bank,
            }),

            // Wallet — separate from bank, stored in nickname
            ...(razorpayPayment.wallet && {
                nickname: razorpayPayment.wallet,
            }),
        };

        // 6. Atomic: update payment + confirm booking in one transaction
        if (isCaptured) {
            const [updatedPayment] = await this.databaseService.$transaction([
                this.databaseService.payment.update({
                    where: { id: payment.id },
                    data: paymentUpdateData,
                }),
                this.databaseService.booking.update({
                    where: { id: payment.bookingId! },
                    data: {
                        status: BookingStatus.CONFIRMED,
                        confirmedAt: new Date(),
                    },
                }),
            ]);
            return updatedPayment;
        }

        // Not captured yet (authorized only) — update payment record only
        return this.databaseService.payment.update({
            where: { id: payment.id },
            data: paymentUpdateData,
        });
    }

    // ─────────────────────────────────────────
    // Get Payment
    // ─────────────────────────────────────────

    async getPayment(paymentId: string, userId?: string) {
        const payment = await this.databaseService.payment.findUnique({
            where: { id: paymentId },
            include: {
                booking: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                email: true,
                                firstName: true,
                                lastName: true,
                            },
                        },
                        items: true,
                    },
                },
                refunds: true,
            },
        });

        if (!payment) {
            throw new NotFoundException('Payment not found');
        }

        if (userId && payment.booking.userId !== userId) {
            throw new ForbiddenException('You do not have access to this payment');
        }

        return payment;
    }

    // ─────────────────────────────────────────
    // Get Payments by Booking
    // ─────────────────────────────────────────

    async getPaymentsByBooking(bookingId: string, userId?: string) {
        const booking = await this.databaseService.booking.findUnique({
            where: { id: bookingId },
        });

        if (!booking) {
            throw new NotFoundException('Booking not found');
        }

        if (userId && booking.userId !== userId) {
            throw new ForbiddenException('You do not have access to this booking');
        }

        return this.databaseService.payment.findMany({
            where: { bookingId },
            include: { refunds: true },
            orderBy: { createdAt: 'desc' },
        });
    }

    // ─────────────────────────────────────────
    // Create Refund
    // ─────────────────────────────────────────

    async createRefund(dto: CreateRefundDto, userId?: string) {
        const payment = await this.databaseService.payment.findUnique({
            where: { id: dto.paymentId },
            include: { booking: true },
        });

        if (!payment) {
            throw new NotFoundException('Payment not found');
        }

        if (userId && payment.booking.userId !== userId) {
            throw new ForbiddenException('You do not have access to this payment');
        }

        if (payment.status !== PaymentStatus.CAPTURED) {
            throw new BadRequestException('Only captured payments can be refunded');
        }

        if (!payment.providerPaymentId) {
            throw new BadRequestException('Payment has no provider payment ID — cannot refund');
        }

        // Calculate how much has already been refunded
        const existingRefunds = await this.databaseService.refund.aggregate({
            where: {
                paymentId: payment.id,
                status: { not: RefundStatus.FAILED },
            },
            _sum: { amount: true },
        });
        const alreadyRefunded = existingRefunds._sum.amount ?? 0;
        const refundable = payment.amount - alreadyRefunded;

        if (refundable <= 0) {
            throw new BadRequestException('This payment has already been fully refunded');
        }

        const refundAmount = dto.amount ?? refundable;

        if (refundAmount <= 0) {
            throw new BadRequestException('Refund amount must be greater than 0');
        }

        if (refundAmount > refundable) {
            throw new BadRequestException(
                `Refund amount ₹${refundAmount} exceeds refundable balance ₹${refundable}`,
            );
        }

        // Issue refund via Razorpay
        const razorpayRefund = await this.razorpayService.refundPayment({
            paymentId: payment.providerPaymentId,
            amount: refundAmount * 100, // paise
            notes: dto.reason ? { reason: dto.reason } : undefined,
        });

        const isFullRefund = refundAmount === payment.amount;
        const refundStatus =
            razorpayRefund.status === 'processed'
                ? RefundStatus.PROCESSED
                : RefundStatus.INITIATED;

        // Atomic: create refund record + update payment/booking status
        const [refund] = await this.databaseService.$transaction([
            this.databaseService.refund.create({
                data: {
                    paymentId: payment.id,
                    amount: razorpayRefund.amount / 100, // back to rupees
                    reason: dto.reason,
                    status: refundStatus,
                    providerRefundId: razorpayRefund.id,
                    ...(refundStatus === RefundStatus.PROCESSED && {
                        processedAt: new Date(),
                    }),
                },
            }),
            // Only mark payment + booking as refunded on a full refund
            ...(isFullRefund
                ? [
                    this.databaseService.payment.update({
                        where: { id: payment.id },
                        data: { status: PaymentStatus.REFUNDED },
                    }),
                    this.databaseService.booking.update({
                        where: { id: payment.bookingId! },
                        data: {
                            status: BookingStatus.REFUNDED,
                            cancelledAt: new Date(),
                        },
                    }),
                ]
                : []),
        ]);

        this.logger.log(
            `Refund ${razorpayRefund.id} issued for payment ${payment.id} — ₹${refundAmount} (${isFullRefund ? 'full' : 'partial'})`,
        );

        return refund;
    }
}