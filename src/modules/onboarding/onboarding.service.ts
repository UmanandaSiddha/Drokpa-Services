import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from 'src/services/database/database.service';
import { CreateOnboardingDto } from './dto/create-onboarding.dto';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { UserRole, ProviderStatus } from 'generated/prisma/enums';
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

    /**
     * Create provider and link to user (used internally by auth service and complete onboarding)
     */
    async createProviderForUser(
        userId: string,
        email: string,
        providerType: string[],
        name: string,
        contactNumber: string,
        onboardingId?: string,
        metadata?: Record<string, any>,
    ) {
        // Check if user already has a provider
        const existingProvider = await this.databaseService.provider.findUnique({
            where: { userId },
        });

        if (existingProvider) {
            return existingProvider;
        }

        // Create Provider and update user roles in a transaction
        return this.databaseService.$transaction(async (tx) => {
            // Create Provider
            const provider = await tx.provider.create({
                data: {
                    name,
                    type: providerType as any,
                    contactNumber,
                    userId: userId,
                    status: ProviderStatus.PENDING,
                    verified: false,
                },
            });

            // Update user roles based on provider types
            const rolesToAdd: UserRole[] = [];
            if (providerType.includes('HOMESTAY_HOST')) {
                rolesToAdd.push(UserRole.HOST);
            }
            if (providerType.includes('VEHICLE_PARTNER')) {
                rolesToAdd.push(UserRole.VENDOR);
            }
            if (providerType.includes('LOCAL_GUIDE')) {
                rolesToAdd.push(UserRole.GUIDE);
            }

            // Add roles if not already present
            for (const role of rolesToAdd) {
                await tx.userRoleMap.upsert({
                    where: {
                        userId_role: {
                            userId,
                            role,
                        },
                    },
                    create: {
                        userId,
                        role,
                    },
                    update: {},
                });
            }

            // Update onboarding record if provided
            if (onboardingId) {
                await tx.onboarding.update({
                    where: { id: onboardingId },
                    data: {
                        completedAt: new Date(),
                        providerId: provider.id,
                        metadata: metadata || {},
                    },
                });
            }

            return provider;
        });
    }

    /**
     * Check if email has pending onboarding invite and auto-complete it
     * Returns provider if created, null if no invite found
     */
    async checkAndCompleteOnboardingByEmail(
        email: string,
        userId: string,
        name?: string,
        contactNumber?: string,
    ) {
        // Find pending onboarding invite for this email
        const onboarding = await this.databaseService.onboarding.findFirst({
            where: {
                email,
                completedAt: null,
                expiresAt: { gt: new Date() },
            },
        });

        if (!onboarding) {
            return null;
        }

        // If name and contactNumber are not provided, we can't create provider yet
        // Return onboarding info so user can complete it manually
        if (!name || !contactNumber) {
            return {
                requiresCompletion: true,
                onboarding,
            };
        }

        // Create provider automatically
        const provider = await this.createProviderForUser(
            userId,
            email,
            onboarding.providerType,
            name,
            contactNumber,
            onboarding.id,
        );

        return {
            provider,
            onboarding,
        };
    }

    async completeOnboarding(dto: CompleteOnboardingDto, userId: string) {
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

        // Verify the user's email matches the onboarding invite email
        const user = await this.databaseService.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (user.email !== onboarding.email) {
            throw new BadRequestException('Email does not match the onboarding invite');
        }

        // Create provider
        const provider = await this.createProviderForUser(
            userId,
            user.email,
            onboarding.providerType,
            dto.name,
            dto.contactNumber,
            onboarding.id,
            dto.metadata,
        );

        return {
            provider,
            message: 'Onboarding completed successfully',
        };
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
