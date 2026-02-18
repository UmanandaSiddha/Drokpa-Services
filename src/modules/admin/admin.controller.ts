import { Controller, Get, Put, Param, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { RoleGuard } from 'src/modules/auth/guards/role.guard';
import { Roles } from 'src/modules/auth/decorator/role.decorator';
import { UserRole, ProviderStatus, BookingStatus } from 'generated/prisma/enums';

@Controller('admin')
@UseGuards(AuthGuard, RoleGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
    constructor(private readonly adminService: AdminService) { }

    @Get('dashboard')
    getDashboardStats() {
        return this.adminService.getDashboardStats();
    }

    @Get('bookings')
    getAllBookings(@Query('status') status?: BookingStatus) {
        return this.adminService.getAllBookings({ status });
    }

    @Get('providers')
    getAllProviders(
        @Query('status') status?: ProviderStatus,
        @Query('verified') verified?: string,
    ) {
        return this.adminService.getAllProviders({
            status,
            verified: verified === 'true' ? true : verified === 'false' ? false : undefined,
        });
    }

    @Put('provider/:id/verify')
    verifyProvider(@Param('id') id: string) {
        return this.adminService.verifyProvider(id);
    }

    @Put('provider/:id/suspend')
    suspendProvider(@Param('id') id: string) {
        return this.adminService.suspendProvider(id);
    }

    @Get('payments')
    getPaymentAnalytics() {
        return this.adminService.getPaymentAnalytics();
    }

    @Get('users')
    getAllUsers() {
        return this.adminService.getAllUsers();
    }
}
