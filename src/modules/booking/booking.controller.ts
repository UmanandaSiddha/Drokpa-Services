import { Controller, Post, Get, Body, Param, Query, UseGuards } from '@nestjs/common';
import { BookingService } from './booking.service';
import { CreateTourBookingDto } from './dto/create-tour-booking.dto';
import { CreateHomestayBookingDto } from './dto/create-homestay-booking.dto';
import { CreateVehicleBookingDto } from './dto/create-vehicle-booking.dto';
import { CreateGuideBookingDto } from './dto/create-guide-booking.dto';
import { ConfirmBookingDto } from './dto/confirm-booking.dto';
import { RejectBookingDto } from './dto/reject-booking.dto';
import { AuthGuard, getUser } from 'src/modules/auth/guards/auth.guard';
import { BookingStatus } from 'generated/prisma/enums';

@Controller('booking')
@UseGuards(AuthGuard)
export class BookingController {
    constructor(private readonly bookingService: BookingService) { }

    @Post('tour/request')
    createTourBooking(
        @Body() dto: CreateTourBookingDto,
        @getUser('id') userId: string,
    ) {
        return this.bookingService.createTourBooking(userId, dto);
    }

    @Post('homestay/request')
    createHomestayBooking(
        @Body() dto: CreateHomestayBookingDto,
        @getUser('id') userId: string,
    ) {
        return this.bookingService.createHomestayBooking(userId, dto);
    }

    @Post('vehicle/request')
    createVehicleBooking(
        @Body() dto: CreateVehicleBookingDto,
        @getUser('id') userId: string,
    ) {
        return this.bookingService.createVehicleBooking(userId, dto);
    }

    @Post('guide/request')
    createGuideBooking(
        @Body() dto: CreateGuideBookingDto,
        @getUser('id') userId: string,
    ) {
        return this.bookingService.createGuideBooking(userId, dto);
    }

    @Post(':id/confirm')
    confirmBooking(
        @Param('id') id: string,
        @Body() dto: ConfirmBookingDto,
        @getUser('providerId') providerId: string,
    ) {
        return this.bookingService.confirmBooking(id, providerId, dto);
    }

    @Post(':id/reject')
    rejectBooking(
        @Param('id') id: string,
        @Body() dto: RejectBookingDto,
        @getUser('providerId') providerId: string,
    ) {
        return this.bookingService.rejectBooking(id, providerId, dto);
    }

    @Get(':id')
    getBooking(
        @Param('id') id: string,
        @getUser('id') userId: string,
    ) {
        return this.bookingService.getBooking(id, userId);
    }

    @Get('my-bookings')
    getMyBookings(
        @getUser('id') userId: string,
        @Query('status') status?: BookingStatus,
    ) {
        return this.bookingService.getMyBookings(userId, status);
    }

    @Get('provider/bookings')
    getProviderBookings(
        @getUser('providerId') providerId: string,
        @Query('status') status?: BookingStatus,
    ) {
        return this.bookingService.getProviderBookings(providerId, status);
    }
}
