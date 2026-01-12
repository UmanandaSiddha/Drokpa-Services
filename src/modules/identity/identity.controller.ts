import { Controller, Post, Get, Body, Query, UseGuards, Res } from '@nestjs/common';
import { Response } from 'express';
import { IdentityService } from './identity.service';
import { VerifyIdentityDto } from './dto/verify-identity.dto';
import { DigiLockerCallbackDto } from './dto/digilocker-callback.dto';
import { AuthGuard, getUser } from 'src/modules/auth/guards/auth.guard';
import { IdentityStatus, IdentityProvider } from 'generated/prisma/enums';

@Controller('identity')
export class IdentityController {
    constructor(private readonly identityService: IdentityService) { }

    @Post('verify')
    @UseGuards(AuthGuard)
    initiateVerification(
        @Body() dto: VerifyIdentityDto,
        @getUser('id') userId: string,
    ) {
        return this.identityService.initiateVerification(userId, dto);
    }

    @Get('status')
    @UseGuards(AuthGuard)
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
    @UseGuards(AuthGuard)
    getMyIdentity(@getUser('id') userId: string) {
        return this.identityService.getMyIdentity(userId);
    }

    @Get('digilocker/initiate')
    @UseGuards(AuthGuard)
    async initiateDigiLocker(
        @getUser('id') userId: string,
        @Res() res: Response,
    ) {
        const result = await this.identityService.initiateDigiLockerVerification(userId);
        // Redirect to DigiLocker OAuth
        return res.redirect(result.authUrl);
    }

    @Get('digilocker/callback')
    @UseGuards(AuthGuard)
    async handleDigiLockerCallback(
        @Query() query: DigiLockerCallbackDto,
        @getUser('id') userId: string,
        @Res() res: Response,
    ) {
        try {
            await this.identityService.handleDigiLockerCallback(userId, query);
            // Redirect to success page
            const frontendUrl = process.env.FRONTEND_URL || 'https://drokpa.com';
            return res.redirect(`${frontendUrl}/identity/verified?success=true`);
        } catch (error) {
            // Redirect to error page
            const frontendUrl = process.env.FRONTEND_URL || 'https://drokpa.com';
            return res.redirect(`${frontendUrl}/identity/verified?success=false&error=${encodeURIComponent(error.message)}`);
        }
    }
}
