import {
    Controller, Post, Get, Patch, Delete,
    Body, Param, Query, UseGuards,
} from '@nestjs/common';
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

    // ── Public ────────────────────────────────

    @Get('token/:token')
    getOnboardingByToken(@Param('token') token: string) {
        return this.onboardingService.getOnboardingByToken(token);
    }

    // ── User (authenticated) ──────────────────

    @Post('complete')
    @UseGuards(AuthGuard)
    completeOnboarding(
        @Body() dto: CompleteOnboardingDto,
        @getUser('id') userId: string,
    ) {
        return this.onboardingService.completeOnboarding(dto, userId);
    }

    // ── Admin ─────────────────────────────────

    @Post('admin/invite')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    createOnboardingInvite(@Body() dto: CreateOnboardingDto) {
        return this.onboardingService.createOnboardingInvite(dto);
    }

    @Get('admin/all')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    getAllOnboardings(@Query() filters: QueryString) {
        return this.onboardingService.getAllOnboardings(filters);
    }

    @Get('admin/pending')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    getPendingOnboardings() {
        return this.onboardingService.getPendingOnboardings();
    }

    @Get('admin/provider/:providerId')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    getOnboardingByProvider(@Param('providerId') providerId: string) {
        return this.onboardingService.getOnboardingByProvider(providerId);
    }

    @Delete('admin/:id/revoke')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    revokeOnboardingInvite(@Param('id') id: string) {
        return this.onboardingService.revokeOnboardingInvite(id);
    }

    @Patch('admin/:id/resend')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    resendOnboardingInvite(@Param('id') id: string) {
        return this.onboardingService.resendOnboardingInvite(id);
    }
}