import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { CreateRefundDto } from './dto/refund.dto';
import { AuthGuard, getUser } from 'src/modules/auth/guards/auth.guard';

@Controller('payment')
@UseGuards(AuthGuard)
export class PaymentController {
    constructor(private readonly paymentService: PaymentService) { }

    @Post('create')
    createPayment(
        @Body() dto: CreatePaymentDto,
        @getUser('id') userId: string,
    ) {
        return this.paymentService.createPayment(dto, userId);
    }

    @Post('verify')
    verifyPayment(
        @Body() dto: VerifyPaymentDto,
        @getUser('id') userId: string,
    ) {
        return this.paymentService.verifyPayment(dto, userId);
    }

    @Get(':id')
    getPayment(
        @Param('id') id: string,
        @getUser('id') userId: string,
    ) {
        return this.paymentService.getPayment(id, userId);
    }

    @Get('booking/:bookingId')
    getPaymentsByBooking(
        @Param('bookingId') bookingId: string,
        @getUser('id') userId: string,
    ) {
        return this.paymentService.getPaymentsByBooking(bookingId, userId);
    }

    @Post('refund')
    createRefund(
        @Body() dto: CreateRefundDto,
        @getUser('id') userId: string,
    ) {
        return this.paymentService.createRefund(dto, userId);
    }
}
