import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { CreateOnboardingDto } from './dto/create-onboarding.dto';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { AuthGuard, getUser } from 'src/modules/auth/guards/auth.guard';
import { RoleGuard } from 'src/modules/auth/guards/role.guard';
import { Roles } from 'src/modules/auth/decorator/role.decorator';
import { UserRole } from 'generated/prisma/enums';

@Controller('onboarding')
export class OnboardingController {
    constructor(private readonly onboardingService: OnboardingService) { }

    @Post('invite')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    createOnboardingInvite(@Body() dto: CreateOnboardingDto) {
        return this.onboardingService.createOnboardingInvite(dto);
    }

    @Get(':token')
    getOnboardingByToken(@Param('token') token: string) {
        return this.onboardingService.getOnboardingByToken(token);
    }

    @Post('complete')
    @UseGuards(AuthGuard)
    completeOnboarding(
        @Body() dto: CompleteOnboardingDto,
        @getUser('id') userId: string,
    ) {
        return this.onboardingService.completeOnboarding(dto, userId);
    }

    @Get('pending')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    getPendingOnboardings() {
        return this.onboardingService.getPendingOnboardings();
    }
}
