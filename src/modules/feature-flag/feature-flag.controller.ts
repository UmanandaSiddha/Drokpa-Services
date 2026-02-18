import { Controller, Get, Put, Body, Param, UseGuards } from '@nestjs/common';
import { FeatureFlagService } from './feature-flag.service';
import { UpdateFeatureFlagDto } from './dto/update-feature-flag.dto';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { RoleGuard } from 'src/modules/auth/guards/role.guard';
import { Roles } from 'src/modules/auth/decorator/role.decorator';
import { UserRole, ProviderType } from 'generated/prisma/enums';

@Controller('feature-flag')
export class FeatureFlagController {
    constructor(private readonly featureFlagService: FeatureFlagService) { }

    @Get()
    getAllFeatureFlags() {
        return this.featureFlagService.getAllFeatureFlags();
    }

    @Get('check/:serviceType')
    async checkService(@Param('serviceType') serviceType: ProviderType) {
        const enabled = await this.featureFlagService.isServiceEnabled(serviceType);
        const message = enabled ? null : await this.featureFlagService.getServiceMessage(serviceType);
        return { enabled, message };
    }

    @Get(':serviceType')
    getFeatureFlag(@Param('serviceType') serviceType: ProviderType) {
        return this.featureFlagService.getFeatureFlag(serviceType);
    }

    @Put(':serviceType')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    updateFeatureFlag(
        @Param('serviceType') serviceType: ProviderType,
        @Body() dto: UpdateFeatureFlagDto,
    ) {
        return this.featureFlagService.updateFeatureFlag(serviceType, dto);
    }
}
