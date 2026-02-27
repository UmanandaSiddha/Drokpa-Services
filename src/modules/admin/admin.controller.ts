import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    ParseEnumPipe,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { RoleGuard } from 'src/modules/auth/guards/role.guard';
import { Roles } from 'src/modules/auth/decorator/role.decorator';
import { UserRole, ProviderStatus, BookingStatus } from 'generated/prisma/enums';
import { QueryString } from 'src/utils/apiFeatures';

@Controller('admin')
@UseGuards(AuthGuard, RoleGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
    constructor(private readonly adminService: AdminService) { }

    // ─────────────────────────────────────────
    // Dashboard
    // ─────────────────────────────────────────

    @Get('dashboard')
    getDashboardStats() {
        return this.adminService.getDashboardStats();
    }

    // ─────────────────────────────────────────
    // Bookings
    // ─────────────────────────────────────────

    @Get('bookings')
    getAllBookings(
        @Query() query: QueryString,
        @Query('status', new ParseEnumPipe(BookingStatus, { optional: true }))
        status?: BookingStatus,
    ) {
        return this.adminService.getAllBookings(query, status);
    }

    /** Confirm a REQUESTED tour booking — moves it to AWAITING_PAYMENT */
    @Patch('bookings/:id/tour/confirm')
    confirmTourBooking(
        @Param('id') id: string,
        @Body('paymentWindowMinutes') paymentWindowMinutes?: number,
    ) {
        return this.adminService.confirmTourBooking(id, paymentWindowMinutes);
    }

    /** Reject a REQUESTED tour booking */
    @Patch('bookings/:id/tour/reject')
    rejectTourBooking(
        @Param('id') id: string,
        @Body('reason') reason?: string,
    ) {
        return this.adminService.rejectTourBooking(id, reason);
    }

    // ─────────────────────────────────────────
    // Providers
    // ─────────────────────────────────────────

    @Get('providers')
    getAllProviders(
        @Query() query: QueryString,
        @Query('status', new ParseEnumPipe(ProviderStatus, { optional: true }))
        status?: ProviderStatus,
        @Query('verified') verified?: string,
    ) {
        return this.adminService.getAllProviders(query, {
            status,
            verified:
                verified === 'true' ? true
                    : verified === 'false' ? false
                        : undefined,
        });
    }

    @Patch('provider/:id/verify')
    verifyProvider(@Param('id') id: string) {
        return this.adminService.verifyProvider(id);
    }

    @Patch('provider/:id/suspend')
    suspendProvider(@Param('id') id: string) {
        return this.adminService.suspendProvider(id);
    }

    // ─────────────────────────────────────────
    // Payments
    // ─────────────────────────────────────────

    @Get('payments')
    getPaymentAnalytics() {
        return this.adminService.getPaymentAnalytics();
    }

    // ─────────────────────────────────────────
    // Users
    // ─────────────────────────────────────────

    @Get('users')
    getAllUsers(@Query() query: QueryString) {
        return this.adminService.getAllUsers(query);
    }

    // ─────────────────────────────────────────
    // Cancellation Policies
    // ─────────────────────────────────────────

    @Post('cancellation-policy')
    createCancellationPolicy(@Body() body: {
        productType: string;
        productId: string;
        hoursBefore: number;
        refundPct: number;
    }) {
        return this.adminService.createCancellationPolicy(body);
    }

    @Get('cancellation-policy')
    getCancellationPolicies(@Query('productId') productId?: string) {
        return this.adminService.getCancellationPolicies(productId);
    }

    @Patch('cancellation-policy/:id')
    updateCancellationPolicy(
        @Param('id') id: string,
        @Body() body: { hoursBefore?: number; refundPct?: number },
    ) {
        return this.adminService.updateCancellationPolicy(id, body);
    }

    @Delete('cancellation-policy/:id')
    deleteCancellationPolicy(@Param('id') id: string) {
        return this.adminService.deleteCancellationPolicy(id);
    }
}