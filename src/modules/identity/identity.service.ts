import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from 'src/services/database/database.service';
import { DigiLockerService } from './digilocker.service';
import { VerifyIdentityDto } from './dto/verify-identity.dto';
import { DigiLockerCallbackDto } from './dto/digilocker-callback.dto';
import { IdentityStatus, IdentityProvider } from 'generated/prisma/enums';

@Injectable()
export class IdentityService {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly digiLockerService: DigiLockerService,
    ) { }

    async initiateVerification(userId: string, dto: VerifyIdentityDto) {
        // Check if identity already exists
        const existing = await this.databaseService.userIdentity.findFirst({
            where: {
                userId,
                provider: dto.provider,
                status: { in: [IdentityStatus.PENDING, IdentityStatus.VERIFIED] },
            },
        });

        if (existing) {
            return existing;
        }

        // For DigiLocker, initiate OAuth flow
        if (dto.provider === IdentityProvider.DIGILOCKER) {
            return this.initiateDigiLockerVerification(userId);
        }

        // For other providers, create pending record
        return this.databaseService.userIdentity.create({
            data: {
                userId,
                provider: dto.provider,
                providerRefId: dto.providerRefId || `temp_${Date.now()}`,
                status: IdentityStatus.PENDING,
            },
        });
    }

    async initiateDigiLockerVerification(userId: string) {
        const state = this.digiLockerService.generateStateToken();
        const authUrl = this.digiLockerService.generateAuthUrl(state);

        // Store state in metadata for verification
        const identity = await this.databaseService.userIdentity.create({
            data: {
                userId,
                provider: IdentityProvider.DIGILOCKER,
                providerRefId: state,
                status: IdentityStatus.PENDING,
                metadata: {
                    state: state,
                    authUrl: authUrl,
                },
            },
        });

        return {
            ...identity,
            authUrl, // Return auth URL for redirect
        };
    }

    async handleDigiLockerCallback(userId: string, dto: DigiLockerCallbackDto) {
        // Find identity by state
        const identity = await this.databaseService.userIdentity.findFirst({
            where: {
                userId,
                provider: IdentityProvider.DIGILOCKER,
                providerRefId: dto.state,
                status: IdentityStatus.PENDING,
            },
        });

        if (!identity) {
            throw new NotFoundException('Identity verification not found or already processed');
        }

        try {
            // Exchange code for access token
            const tokenData = await this.digiLockerService.exchangeCodeForToken(dto.code);

            // Fetch user profile
            const profile = await this.digiLockerService.fetchUserProfile(tokenData.access_token);

            // Fetch user documents (Aadhaar, etc.)
            const documents = await this.digiLockerService.fetchUserDocuments(tokenData.access_token);

            // Update identity with verified status
            const updatedIdentity = await this.databaseService.userIdentity.update({
                where: { id: identity.id },
                data: {
                    status: IdentityStatus.VERIFIED,
                    verifiedAt: new Date(),
                    providerRefId: profile.uid || profile.aadhaar_number || dto.state,
                    metadata: {
                        profile,
                        documents,
                        accessToken: tokenData.access_token, // Store temporarily for document access
                        expiresIn: tokenData.expires_in,
                    },
                },
            });

            return updatedIdentity;
        } catch (error) {
            // Update identity with failed status
            await this.databaseService.userIdentity.update({
                where: { id: identity.id },
                data: {
                    status: IdentityStatus.FAILED,
                    metadata: {
                        error: error.message,
                    },
                },
            });
            throw error;
        }
    }

    async getVerificationStatus(userId: string) {
        return this.databaseService.userIdentity.findMany({
            where: { userId },
        });
    }

    async handleCallback(provider: IdentityProvider, providerRefId: string, status: IdentityStatus, metadata?: any) {
        const identity = await this.databaseService.userIdentity.findFirst({
            where: {
                provider,
                providerRefId,
            },
        });

        if (!identity) {
            throw new NotFoundException('Identity verification not found');
        }

        return this.databaseService.userIdentity.update({
            where: { id: identity.id },
            data: {
                status,
                verifiedAt: status === IdentityStatus.VERIFIED ? new Date() : null,
                metadata: metadata || {},
            },
        });
    }

    async getMyIdentity(userId: string) {
        const identities = await this.databaseService.userIdentity.findMany({
            where: { userId },
        });

        return {
            verified: identities.some(i => i.status === IdentityStatus.VERIFIED),
            identities,
        };
    }
}
