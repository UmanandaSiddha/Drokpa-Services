import {
    Controller, Post, Get, Body,
    Param, Query, UseGuards, ParseEnumPipe,
} from '@nestjs/common';
import { BookingService } from './booking.service';
import { CreateTourBookingDto } from './dto/create-tour-booking.dto';
import { CreateHomestayBookingDto } from './dto/create-homestay-booking.dto';
import { CreateVehicleBookingDto } from './dto/create-vehicle-booking.dto';
import { CreateGuideBookingDto } from './dto/create-guide-booking.dto';
import { CreateIlpBookingDto } from './dto/create-ilp-booking.dto';
import { CreateTourQuoteDto } from './dto/create-tour-quote.dto';
import { CreateTourCustomDateRequestDto } from './dto/create-tour-custom-date-request.dto';
import { ApproveTourCustomDateRequestDto } from './dto/approve-tour-custom-date-request.dto';
import { RejectTourCustomDateRequestDto } from './dto/reject-tour-custom-date-request.dto';
import { CreateBookingFromCustomDateRequestDto } from './dto/create-booking-from-custom-date-request.dto';
import { ConfirmBookingDto } from './dto/confirm-booking.dto';
import { RejectBookingDto } from './dto/reject-booking.dto';
import { AuthGuard, getUser } from 'src/modules/auth/guards/auth.guard';
import { RoleGuard } from 'src/modules/auth/guards/role.guard';
import { Roles } from 'src/modules/auth/decorator/role.decorator';
import { BookingDateRequestStatus, BookingStatus, UserRole } from 'generated/prisma/enums';

@Controller('booking')
@UseGuards(AuthGuard)
export class BookingController {
    constructor(private readonly bookingService: BookingService) { }

    // ── Booking creation ──────────────────────

    @Post('tour/quote')
    quoteTourBooking(
        @Body() dto: CreateTourQuoteDto,
        @getUser('id') userId: string,
    ) {
        return this.bookingService.quoteTourBooking(userId, dto);
    }

    @Get('tour/:tourId/suggested-treks')
    getSuggestedTreksForTour(
        @Param('tourId') tourId: string,
        @Query('participants') participants?: string,
    ) {
        return this.bookingService.getSuggestedTreksForTour(
            tourId,
            participants ? parseInt(participants, 10) : undefined,
        );
    }

    @Post('tour/request')
    createTourBooking(
        @Body() dto: CreateTourBookingDto,
        @getUser('id') userId: string,
    ) {
        return this.bookingService.createTourBooking(userId, dto);
    }

    @Post('ilp/request')
    createIlpBooking(
        @Body() dto: CreateIlpBookingDto,
        @getUser('id') userId: string,
    ) {
        return this.bookingService.createIlpBooking(userId, dto);
    }

    @Post('tour/custom-date/request')
    createTourCustomDateRequest(
        @Body() dto: CreateTourCustomDateRequestDto,
        @getUser('id') userId: string,
    ) {
        return this.bookingService.createTourCustomDateRequest(userId, dto);
    }

    @Get('tour/custom-date/my-requests')
    getMyTourCustomDateRequests(@getUser('id') userId: string) {
        return this.bookingService.getMyTourCustomDateRequests(userId);
    }

    @Get('tour/custom-date/requests')
    @UseGuards(RoleGuard)
    @Roles(UserRole.ADMIN)
    getTourCustomDateRequestsForAdmin(
        @Query('status', new ParseEnumPipe(BookingDateRequestStatus, { optional: true }))
        status?: BookingDateRequestStatus,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.bookingService.getTourCustomDateRequestsForAdmin({
            status,
            page: page ? parseInt(page, 10) : undefined,
            limit: limit ? parseInt(limit, 10) : undefined,
        });
    }

    @Get('tour/custom-date/request/:id')
    getTourCustomDateRequestById(
        @Param('id') requestId: string,
        @getUser('id') userId: string,
        @getUser('roles') userRoles: { role: UserRole }[],
    ) {
        const isAdmin = userRoles.some(r => r.role === UserRole.ADMIN);
        return this.bookingService.getTourCustomDateRequestById(requestId, userId, isAdmin);
    }

    @Post('tour/custom-date/request/:id/approve')
    @UseGuards(RoleGuard)
    @Roles(UserRole.ADMIN)
    approveTourCustomDateRequest(
        @Param('id') requestId: string,
        @Body() dto: ApproveTourCustomDateRequestDto,
        @getUser('id') adminUserId: string,
    ) {
        return this.bookingService.approveTourCustomDateRequest(requestId, adminUserId, dto);
    }

    @Post('tour/custom-date/request/:id/reject')
    @UseGuards(RoleGuard)
    @Roles(UserRole.ADMIN)
    rejectTourCustomDateRequest(
        @Param('id') requestId: string,
        @Body() dto: RejectTourCustomDateRequestDto,
        @getUser('id') adminUserId: string,
    ) {
        return this.bookingService.rejectTourCustomDateRequest(requestId, adminUserId, dto);
    }

    @Post('tour/custom-date/request/:id/create-booking')
    @UseGuards(RoleGuard)
    @Roles(UserRole.ADMIN)
    createBookingFromTourCustomDateRequest(
        @Param('id') requestId: string,
        @Body() dto: CreateBookingFromCustomDateRequestDto,
        @getUser('id') adminUserId: string,
    ) {
        return this.bookingService.createBookingFromTourCustomDateRequest(
            requestId,
            adminUserId,
            dto,
        );
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

    @Get('my-bookings/last')
    getMyLastBookingForPrefill(@getUser('id') userId: string) {
        return this.bookingService.getMyLastBookingForPrefill(userId);
    }

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