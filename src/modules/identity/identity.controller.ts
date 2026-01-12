import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { IdentityService } from './identity.service';
import { VerifyIdentityDto } from './dto/verify-identity.dto';
import { AuthGuard, getUser } from 'src/modules/auth/guards/auth.guard';
import { IdentityStatus, IdentityProvider } from 'generated/prisma/enums';

@Controller('identity')
@UseGuards(AuthGuard)
export class IdentityController {
    constructor(private readonly identityService: IdentityService) { }

    @Post('verify')
    initiateVerification(
        @Body() dto: VerifyIdentityDto,
        @getUser('id') userId: string,
    ) {
        return this.identityService.initiateVerification(userId, dto);
    }

    @Get('status')
    getVerificationStatus(@getUser('id') userId: string) {
        return this.identityService.getVerificationStatus(userId);
    }

    @Post('callback')
    handleCallback(
        @Body('provider') provider: IdentityProvider,
        @Body('providerRefId') providerRefId: string,
        @Body('status') status: IdentityStatus,
        @Body('metadata') metadata?: any,
    ) {
        return this.identityService.handleCallback(provider, providerRefId, status, metadata);
    }

    @Get('my-identity')
    getMyIdentity(@getUser('id') userId: string) {
        return this.identityService.getMyIdentity(userId);
    }
}
