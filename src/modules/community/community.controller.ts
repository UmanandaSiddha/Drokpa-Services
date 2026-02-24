import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Param,
    Body,
    UseGuards,
    HttpCode,
    HttpStatus,
    Query,
} from '@nestjs/common';
import { CommunityService } from './community.service';
import { getUser } from 'src/modules/auth/guards/auth.guard';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { RoleGuard } from 'src/modules/auth/guards/role.guard';
import { Roles } from 'src/modules/auth/decorator/role.decorator';
import { UserRole } from 'generated/prisma/enums';
import { QueryString } from 'src/utils/apiFeatures';

@Controller('community')
export class CommunityController {
    constructor(private readonly communityService: CommunityService) { }

    /**
     * POST /community/join
     * Submit request to join community (public)
     */
    @Post('join')
    @HttpCode(HttpStatus.CREATED)
    async submitJoinRequest(
        @Body()
        data: {
            fullName: string;
            email: string;
            phoneNumber: string;
            location?: string;
            interests: string[];
            message?: string;
        },
    ) {
        const request = await this.communityService.submitJoinRequest(data);
        return {
            statusCode: HttpStatus.CREATED,
            message: 'Community join request submitted',
            data: request,
        };
    }

    /**
     * GET /community/check/:email
     * Check join request by email (public)
     */
    @Get('check/:email')
    async getRequestByEmail(@Param('email') email: string) {
        const request = await this.communityService.getRequestByEmail(email);
        return {
            statusCode: HttpStatus.OK,
            message: 'Join request found',
            data: request,
        };
    }

    /**
     * GET /community/admin/requests
     * Get all join requests (admin)
     */
    @Get('admin/requests')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    async getAllRequests(
        @getUser('id') userId: string,
        @Query() query: QueryString,
    ) {
        const result = await this.communityService.getAllRequests(query);
        return {
            statusCode: HttpStatus.OK,
            message: 'All community join requests retrieved',
            ...result,
        };
    }

    /**
     * PATCH /community/admin/requests/:id/contact
     * Mark request as contacted (admin)
     */
    @Patch('admin/requests/:id/contact')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    async markAsContacted(
        @getUser('id') userId: string,
        @Param('id') requestId: string,
        @Body() data?: { notes?: string },
    ) {
        const request = await this.communityService.markAsContacted(
            requestId,
            data?.notes,
        );
        return {
            statusCode: HttpStatus.OK,
            message: 'Request marked as contacted',
            data: request,
        };
    }

    /**
     * PATCH /community/admin/requests/:id/notes
     * Update notes (admin)
     */
    @Patch('admin/requests/:id/notes')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    async updateNotes(
        @getUser('id') userId: string,
        @Param('id') requestId: string,
        @Body() data: { notes: string },
    ) {
        const request = await this.communityService.updateNotes(
            requestId,
            data.notes,
        );
        return {
            statusCode: HttpStatus.OK,
            message: 'Notes updated',
            data: request,
        };
    }

    /**
     * DELETE /community/admin/requests/:id
     * Delete join request (admin)
     */
    @Delete('admin/requests/:id')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    async deleteRequest(
        @getUser('id') userId: string,
        @Param('id') requestId: string,
    ) {
        await this.communityService.deleteRequest(requestId);
        return {
            statusCode: HttpStatus.OK,
            message: 'Join request deleted',
        };
    }

    /**
     * GET /community/admin/stats
     * Get community statistics (admin)
     */
    @Get('admin/stats')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    async getCommunityStats(@getUser('id') userId: string) {
        const stats = await this.communityService.getCommunityStats();
        return {
            statusCode: HttpStatus.OK,
            message: 'Community statistics retrieved',
            data: stats,
        };
    }
}
