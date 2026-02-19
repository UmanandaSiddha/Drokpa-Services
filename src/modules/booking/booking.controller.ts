import {
    Controller, Post, Get, Body,
    Param, Query, UseGuards, ParseEnumPipe,
} from '@nestjs/common';
import { BookingService } from './booking.service';
import { CreateTourBookingDto } from './dto/create-tour-booking.dto';
import { CreateHomestayBookingDto } from './dto/create-homestay-booking.dto';
import { CreateVehicleBookingDto } from './dto/create-vehicle-booking.dto';
import { CreateGuideBookingDto } from './dto/create-guide-booking.dto';
import { ConfirmBookingDto } from './dto/confirm-booking.dto';
import { RejectBookingDto } from './dto/reject-booking.dto';
import { AuthGuard, getUser } from 'src/modules/auth/guards/auth.guard';
import { RoleGuard } from 'src/modules/auth/guards/role.guard';
import { Roles } from 'src/modules/auth/decorator/role.decorator';
import { BookingStatus, UserRole } from 'generated/prisma/enums';

@Controller('booking')
@UseGuards(AuthGuard)
export class BookingController {
    constructor(private readonly bookingService: BookingService) { }

    // ── Booking creation ──────────────────────

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

    // ── Provider actions ──────────────────────

    @Post(':id/confirm')
    @UseGuards(RoleGuard)
    @Roles(UserRole.HOST, UserRole.VENDOR)
    confirmBooking(
        @Param('id') id: string,
        @Body() dto: ConfirmBookingDto,
        @getUser('id') userId: string,
    ) {
        return this.bookingService.confirmBooking(id, userId, dto);
    }

    @Post(':id/reject')
    @UseGuards(RoleGuard)
    @Roles(UserRole.HOST, UserRole.VENDOR)
    rejectBooking(
        @Param('id') id: string,
        @Body() dto: RejectBookingDto,
        @getUser('id') userId: string,
    ) {
        return this.bookingService.rejectBooking(id, userId, dto);
    }

    // ── Queries — static routes MUST be above :id ──

    @Get('my-bookings')
    getMyBookings(
        @getUser('id') userId: string,
        @Query('status', new ParseEnumPipe(BookingStatus, { optional: true }))
        status?: BookingStatus,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.bookingService.getMyBookings(userId, {
            status,
            page: page ? parseInt(page, 10) : undefined,
            limit: limit ? parseInt(limit, 10) : undefined,
        });
    }

    @Get('provider/bookings')
    @UseGuards(RoleGuard)
    @Roles(UserRole.HOST, UserRole.VENDOR)
    getProviderBookings(
        @getUser('id') userId: string,
        @Query('status', new ParseEnumPipe(BookingStatus, { optional: true }))
        status?: BookingStatus,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.bookingService.getProviderBookings(userId, {
            status,
            page: page ? parseInt(page, 10) : undefined,
            limit: limit ? parseInt(limit, 10) : undefined,
        });
    }

    // ── Must be last — catch-all param route ──

    @Get(':id')
    getBooking(
        @Param('id') id: string,
        @getUser('id') userId: string,
    ) {
        return this.bookingService.getBooking(id, userId);
    }
}