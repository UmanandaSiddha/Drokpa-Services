import {
    Controller,
    Get,
    Post,
    Delete,
    Param,
    Body,
    UseGuards,
    HttpCode,
    HttpStatus,
    Query,
} from '@nestjs/common';
import { ServiceWaitlistService } from './service-waitlist.service';
import { getUser } from 'src/modules/auth/guards/auth.guard';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { RoleGuard } from 'src/modules/auth/guards/role.guard';
import { Roles } from 'src/modules/auth/decorator/role.decorator';
import { UserRole, ProviderType } from 'generated/prisma/enums';
import { QueryString } from 'src/utils/apiFeatures';

@Controller('waitlist')
export class ServiceWaitlistController {
    constructor(private readonly serviceWaitlistService: ServiceWaitlistService) { }

    /**
     * POST /waitlist/join
     * Join a service waitlist (public)
     */
    @Post('join')
    @HttpCode(HttpStatus.CREATED)
    async joinWaitlist(
        @Body() data: {
            email: string;
            name?: string;
            phoneNumber?: string;
            serviceType: ProviderType;
            location?: string;
            metadata?: any;
        },
    ) {
        const result = await this.serviceWaitlistService.joinWaitlist(data);
        return {
            statusCode: HttpStatus.CREATED,
            message: 'Successfully joined waitlist',
            data: result,
        };
    }

    /**
     * GET /waitlist/admin/:serviceType
     * Get waitlist by service type (admin)
     */
    @Get('admin/:serviceType')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    async getWaitlistByService(
        @getUser('id') userId: string,
        @Param('serviceType') serviceType: ProviderType,
        @Query() query: QueryString,
    ) {
        const result = await this.serviceWaitlistService.getWaitlistByService(
            serviceType,
            query,
        );
        return {
            statusCode: HttpStatus.OK,
            message: 'Waitlist retrieved',
            ...result,
        };
    }

    /**
     * DELETE /waitlist/admin/:id
     * Remove from waitlist (admin)
     */
    @Delete('admin/:id')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    async removeFromWaitlist(
        @getUser('id') userId: string,
        @Param('id') waitlistId: string,
    ) {
        await this.serviceWaitlistService.removeFromWaitlist(waitlistId);
        return {
            statusCode: HttpStatus.OK,
            message: 'Removed from waitlist',
        };
    }

    /**
     * POST /waitlist/admin/:serviceType/notify
     * Notify waitlist users (admin)
     */
    @Post('admin/:serviceType/notify')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    async notifyWaitlist(
        @getUser('id') userId: string,
        @Param('serviceType') serviceType: ProviderType,
    ) {
        const result = await this.serviceWaitlistService.notifyWaitlist(serviceType);
        return {
            statusCode: HttpStatus.OK,
            message: 'Waitlist notifications sent',
            data: result,
        };
    }

    /**
     * GET /waitlist/admin/stats
     * Get waitlist statistics (admin)
     */
    @Get('admin/stats')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    async getWaitlistStats(@getUser('id') userId: string) {
        const stats = await this.serviceWaitlistService.getWaitlistStats();
        return {
            statusCode: HttpStatus.OK,
            message: 'Waitlist statistics',
            data: stats,
        };
    }
}
