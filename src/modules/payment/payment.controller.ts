import {
    Controller, Post, Get, Body,
    Param, UseGuards, HttpCode,
} from '@nestjs/common';
import { UserRole } from 'generated/prisma/enums';
import { AuthGuard, getUser } from 'src/modules/auth/guards/auth.guard';
import { RoleGuard } from 'src/modules/auth/guards/role.guard';
import { Roles } from 'src/modules/auth/decorator/role.decorator';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { CreateRefundDto } from './dto/refund.dto';

@Controller('payment')
@UseGuards(AuthGuard)
export class PaymentController {
    constructor(private readonly paymentService: PaymentService) { }

    @Post('create')
    @HttpCode(200)
    createPayment(
        @Body() dto: CreatePaymentDto,
        @getUser('id') userId: string,
    ) {
        return this.paymentService.createPayment(dto, userId);
    }

    @Post('verify')
    @HttpCode(200)
    verifyPayment(
        @Body() dto: VerifyPaymentDto,
        @getUser('id') userId: string,
    ) {
        return this.paymentService.verifyPayment(dto, userId);
    }

    @Get('booking/:bookingId')
    getPaymentsByBooking(
        @Param('bookingId') bookingId: string,
        @getUser('id') userId: string,
    ) {
        return this.paymentService.getPaymentsByBooking(bookingId, userId);
    }

    @Get(':id')
    getPayment(
        @Param('id') id: string,
        @getUser('id') userId: string,
    ) {
        return this.paymentService.getPayment(id, userId);
    }

    // Refund is an admin action — users go through the cancellation flow instead
    @Post('refund')
    @HttpCode(200)
    @UseGuards(RoleGuard)
    @Roles(UserRole.ADMIN)
    createRefund(@Body() dto: CreateRefundDto) {
        return this.paymentService.createRefund(dto);
    }
}