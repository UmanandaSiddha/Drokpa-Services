import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/services/database/database.service';
import { RazorpayService } from 'src/services/razorpay/razorpay.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { CreateRefundDto } from './dto/refund.dto';
import { PaymentStatus, PaymentProvider } from 'generated/prisma/enums';

@Injectable()
export class PaymentService {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly razorpayService: RazorpayService,
    ) { }

    async createPayment(dto: CreatePaymentDto, userId: string) {
        // Verify booking exists and belongs to user
        const booking = await this.databaseService.booking.findFirst({
            where: {
                id: dto.bookingId,
                userId,
                status: 'AWAITING_PAYMENT',
            },
            include: {
                items: true,
            },
        });

        if (!booking) {
            throw new NotFoundException('Booking not found or not ready for payment');
        }

        // Calculate total amount from booking items
        const totalAmount = booking.items.reduce((sum, item) => sum + item.price, 0);

        if (dto.amount !== totalAmount) {
            throw new BadRequestException('Payment amount does not match booking total');
        }

        // Create Razorpay order
        const order = await this.razorpayService.createOrder({
            amount: dto.amount * 100, // Convert to paise
            currency: dto.currency || 'INR',
            receipt: dto.bookingId,
            notes: {
                bookingId: dto.bookingId,
                userId,
                ...(dto.notes && { notes: dto.notes }),
            },
        });

        // Create payment record
        const payment = await this.databaseService.payment.create({
            data: {
                bookingId: dto.bookingId,
                amount: dto.amount,
                currency: dto.currency || 'INR',
                provider: PaymentProvider.RAZORPAY,
                status: PaymentStatus.CREATED,
                providerOrderId: order.id,
                notes: dto.notes,
            },
        });

        return {
            paymentId: payment.id,
            orderId: order.id,
            amount: Number(order.amount) / 100, // Convert back to rupees
            currency: order.currency,
            key: process.env.RAZORPAY_KEY_ID,
        };
    }

    async verifyPayment(dto: VerifyPaymentDto, userId: string) {
        // Verify signature
        const isValid = this.razorpayService.verifyPaymentSignature({
            orderId: dto.orderId,
            paymentId: dto.paymentId,
            signature: dto.signature,
        });

        if (!isValid) {
            throw new BadRequestException('Invalid payment signature');
        }

        // Find payment record
        const payment = await this.databaseService.payment.findFirst({
            where: {
                providerOrderId: dto.orderId,
                booking: {
                    userId,
                },
            },
            include: {
                booking: true,
            },
        });

        if (!payment) {
            throw new NotFoundException('Payment not found');
        }

        // Get payment details from Razorpay
        const razorpayPayment = await this.razorpayService.getPayment(dto.paymentId);

        // Update payment record
        const updatedPayment = await this.databaseService.payment.update({
            where: { id: payment.id },
            data: {
                providerPaymentId: dto.paymentId,
                status: razorpayPayment.status === 'captured' ? PaymentStatus.CAPTURED : PaymentStatus.AUTHORIZED,
                method: razorpayPayment.method as any,
                ...(razorpayPayment.card && {
                    cardLast4: razorpayPayment.card.last4,
                    cardNetwork: razorpayPayment.card.network,
                    cardBank: razorpayPayment.card.issuer,
                }),
                ...(razorpayPayment.vpa && {
                    upiVpa: razorpayPayment.vpa,
                    upiName: razorpayPayment.acquirer_data?.upi_transaction_id,
                }),
                ...(razorpayPayment.bank && {
                    bankCode: razorpayPayment.bank,
                    bankName: razorpayPayment.wallet,
                }),
            },
        });

        // Update booking status if payment is captured
        if (razorpayPayment.status === 'captured') {
            await this.databaseService.booking.update({
                where: { id: payment.bookingId },
                data: { status: 'CONFIRMED' },
            });
        }

        return updatedPayment;
    }

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

        // If userId provided, verify ownership
        if (userId && payment.booking.userId !== userId) {
            throw new BadRequestException('Unauthorized access to payment');
        }

        return payment;
    }

    async getPaymentsByBooking(bookingId: string, userId?: string) {
        const booking = await this.databaseService.booking.findUnique({
            where: { id: bookingId },
        });

        if (!booking) {
            throw new NotFoundException('Booking not found');
        }

        if (userId && booking.userId !== userId) {
            throw new BadRequestException('Unauthorized access to booking');
        }

        return this.databaseService.payment.findMany({
            where: { bookingId },
            include: {
                refunds: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async createRefund(dto: CreateRefundDto, userId?: string) {
        const payment = await this.databaseService.payment.findUnique({
            where: { id: dto.paymentId },
            include: {
                booking: true,
            },
        });

        if (!payment) {
            throw new NotFoundException('Payment not found');
        }

        if (userId && payment.booking.userId !== userId) {
            throw new BadRequestException('Unauthorized access to payment');
        }

        if (payment.status !== PaymentStatus.CAPTURED) {
            throw new BadRequestException('Payment must be captured to refund');
        }

        if (!payment.providerPaymentId) {
            throw new BadRequestException('Payment provider ID not found');
        }

        // Create refund via Razorpay
        const razorpayRefund = await this.razorpayService.refundPayment({
            paymentId: payment.providerPaymentId,
            amount: dto.amount ? dto.amount * 100 : undefined, // Convert to paise
            notes: dto.reason ? { reason: dto.reason } : undefined,
        });

        // Create refund record
        const refund = await this.databaseService.refund.create({
            data: {
                paymentId: payment.id,
                amount: razorpayRefund.amount / 100, // Convert back to rupees
                reason: dto.reason,
                status: razorpayRefund.status === 'processed' ? 'PROCESSED' : 'INITIATED',
            },
        });

        // Update payment status if full refund
        if (!dto.amount || dto.amount >= payment.amount) {
            await this.databaseService.payment.update({
                where: { id: payment.id },
                data: { status: PaymentStatus.REFUNDED },
            });

            await this.databaseService.booking.update({
                where: { id: payment.bookingId },
                data: { status: 'REFUNDED' },
            });
        }

        return refund;
    }
}
