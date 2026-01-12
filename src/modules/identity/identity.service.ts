import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/services/database/database.service';
import { VerifyIdentityDto } from './dto/verify-identity.dto';
import { IdentityStatus, IdentityProvider } from 'generated/prisma/enums';

@Injectable()
export class IdentityService {
    constructor(
        private readonly databaseService: DatabaseService,
    ) { }

    async initiateVerification(userId: string, dto: VerifyIdentityDto) {
        // In a real implementation, this would integrate with DigiLocker API
        // For now, we'll create a pending identity record
        
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

        return this.databaseService.userIdentity.create({
            data: {
                userId,
                provider: dto.provider,
                providerRefId: dto.providerRefId || `temp_${Date.now()}`,
                status: IdentityStatus.PENDING,
            },
        });
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
