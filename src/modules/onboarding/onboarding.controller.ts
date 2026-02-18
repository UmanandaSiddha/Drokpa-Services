import { Controller, Post, Get, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { CreateOnboardingDto } from './dto/create-onboarding.dto';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { AuthGuard, getUser } from 'src/modules/auth/guards/auth.guard';
import { RoleGuard } from 'src/modules/auth/guards/role.guard';
import { Roles } from 'src/modules/auth/decorator/role.decorator';
import { UserRole } from 'generated/prisma/enums';
import { QueryString } from 'src/utils/apiFeatures';

@Controller('onboarding')
export class OnboardingController {
    constructor(private readonly onboardingService: OnboardingService) { }

    // ─────────────────────────────────────────────
    // PUBLIC
    // ─────────────────────────────────────────────

    // Get onboarding details by token (for pre-filling the form)
    // NOTE: Must be above any :token param routes to avoid conflict
    @Get('token/:token')
    getOnboardingByToken(@Param('token') token: string) {
        return this.onboardingService.getOnboardingByToken(token);
    }

    // ─────────────────────────────────────────────
    // USER (authenticated)
    // ─────────────────────────────────────────────

    // Complete onboarding using token
    @Post('complete')
    @UseGuards(AuthGuard)
    completeOnboarding(
        @Body() dto: CompleteOnboardingDto,
        @getUser('id') userId: string,
    ) {
        return this.onboardingService.completeOnboarding(dto, userId);
    }

    // ─────────────────────────────────────────────
    // ADMIN
    // ─────────────────────────────────────────────

    // Create onboarding invite
    @Post('admin/invite')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    createOnboardingInvite(@Body() dto: CreateOnboardingDto) {
        return this.onboardingService.createOnboardingInvite(dto);
    }

    // Get all onboardings (paginated, all statuses)
    @Get('admin/all')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    getAllOnboardings(@Query() filters: QueryString) {
        return this.onboardingService.getAllOnboardings(filters);
    }

    // Get pending onboardings only
    @Get('admin/pending')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    getPendingOnboardings() {
        return this.onboardingService.getPendingOnboardings();
    }

    // Get onboarding by provider ID
    @Get('admin/provider/:providerId')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    getOnboardingByProvider(@Param('providerId') providerId: string) {
        return this.onboardingService.getOnboardingByProvider(providerId);
    }

    // Revoke onboarding invite
    @Delete('admin/:id/revoke')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    revokeOnboardingInvite(@Param('id') id: string) {
        return this.onboardingService.revokeOnboardingInvite(id);
    }

    // Resend / extend onboarding invite
    @Put('admin/:id/resend')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    resendOnboardingInvite(@Param('id') id: string) {
        return this.onboardingService.resendOnboardingInvite(id);
    }
}