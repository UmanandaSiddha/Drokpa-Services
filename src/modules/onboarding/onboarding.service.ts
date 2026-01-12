import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from 'src/services/database/database.service';
import { CreateOnboardingDto } from './dto/create-onboarding.dto';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import * as crypto from 'crypto';

@Injectable()
export class OnboardingService {
    constructor(
        private readonly databaseService: DatabaseService,
    ) { }

    async createOnboardingInvite(dto: CreateOnboardingDto) {
        // Generate unique token
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

        return this.databaseService.onboarding.create({
            data: {
                ...dto,
                token,
                expiresAt,
            },
        });
    }

    async getOnboardingByToken(token: string) {
        const onboarding = await this.databaseService.onboarding.findUnique({
            where: { token },
        });

        if (!onboarding) {
            throw new NotFoundException('Onboarding invite not found');
        }

        if (new Date() > onboarding.expiresAt) {
            throw new BadRequestException('Onboarding invite has expired');
        }

        if (onboarding.completedAt) {
            throw new BadRequestException('Onboarding invite has already been used');
        }

        return onboarding;
    }

    async completeOnboarding(dto: CompleteOnboardingDto, providerId: string) {
        const onboarding = await this.databaseService.onboarding.findUnique({
            where: { token: dto.token },
        });

        if (!onboarding) {
            throw new NotFoundException('Onboarding invite not found');
        }

        if (new Date() > onboarding.expiresAt) {
            throw new BadRequestException('Onboarding invite has expired');
        }

        if (onboarding.completedAt) {
            throw new BadRequestException('Onboarding invite has already been used');
        }

        return this.databaseService.onboarding.update({
            where: { token: dto.token },
            data: {
                completedAt: new Date(),
                providerId,
                metadata: dto.metadata || {},
            },
        });
    }

    async getPendingOnboardings() {
        return this.databaseService.onboarding.findMany({
            where: {
                completedAt: null,
                expiresAt: {
                    gt: new Date(),
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
}
