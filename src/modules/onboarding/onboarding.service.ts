import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { DatabaseService } from 'src/services/database/database.service';
import { CreateOnboardingDto } from './dto/create-onboarding.dto';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { UserRole, ProviderStatus, ProviderType } from 'generated/prisma/enums';
import { PrismaApiFeatures, QueryString } from 'src/utils/apiFeatures';
import { Prisma, Provider } from 'generated/prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class OnboardingService {
    constructor(
        private readonly databaseService: DatabaseService,
    ) { }

    // ─────────────────────────────────────────────
    // Private Helpers
    // ─────────────────────────────────────────────

    // Validate onboarding token — shared across multiple methods
    private async validateOnboardingToken(token: string) {
        const onboarding = await this.databaseService.onboarding.findUnique({
            where: { token },
        });
        if (!onboarding) throw new NotFoundException('Onboarding invite not found');
        if (new Date() > onboarding.expiresAt) throw new BadRequestException('Onboarding invite has expired');
        if (onboarding.completedAt) throw new BadRequestException('Onboarding invite has already been used');
        return onboarding;
    }

    // Map ProviderType values to UserRole values
    private mapProviderTypesToRoles(providerTypes: string[]): UserRole[] {
        const roleMap: Partial<Record<ProviderType, UserRole>> = {
            HOMESTAY_HOST: UserRole.HOST,
            VEHICLE_PARTNER: UserRole.VENDOR,
            LOCAL_GUIDE: UserRole.GUIDE,
            TOUR_VENDOR: UserRole.VENDOR,
            ACTIVITY_VENDOR: UserRole.VENDOR,
            ILP_VENDOR: UserRole.VENDOR,
        };

        const roles = providerTypes
            .map((type) => roleMap[type as ProviderType])
            .filter((role): role is UserRole => !!role);

        // Deduplicate
        return [...new Set(roles)];
    }

    // ─────────────────────────────────────────────
    // Core Provider Creation
    // ─────────────────────────────────────────────

    /**
     * Create provider and link to user — used internally by auth service and completeOnboarding.
     * If provider already exists, merges new providerTypes into existing provider.
     */
    async createProviderForUser(
        userId: string,
        providerTypes: string[],
        name: string,
        contactNumber: string,
        onboardingId?: string,
        metadata?: Record<string, any>,
    ) {
        return this.databaseService.$transaction(async (tx) => {
            const existingProvider = await tx.provider.findUnique({
                where: { userId },
            });

            let provider: Provider;

            if (existingProvider) {
                // Merge new types with existing — avoid duplicates
                const mergedTypes = [...new Set([...existingProvider.type, ...providerTypes])] as ProviderType[];
                provider = await tx.provider.update({
                    where: { id: existingProvider.id },
                    data: { type: mergedTypes },
                });
            } else {
                provider = await tx.provider.create({
                    data: {
                        name,
                        type: providerTypes as ProviderType[],
                        contactNumber,
                        userId,
                        status: ProviderStatus.PENDING,
                        verified: false,
                    },
                });
            }

            // Map provider types to roles and upsert each
            const rolesToAdd = this.mapProviderTypesToRoles(providerTypes);
            for (const role of rolesToAdd) {
                await tx.userRoleMap.upsert({
                    where: { userId_role: { userId, role } },
                    create: { userId, role },
                    update: {},
                });
            }

            // Mark onboarding as completed if provided
            if (onboardingId) {
                await tx.onboarding.update({
                    where: { id: onboardingId },
                    data: {
                        completedAt: new Date(),
                        providerId: provider.id,
                        metadata: metadata ?? {},
                    },
                });
            }

            return provider;
        });
    }

    // ─────────────────────────────────────────────
    // ADMIN
    // ─────────────────────────────────────────────

    // ADMIN: Create onboarding invite
    async createOnboardingInvite(dto: CreateOnboardingDto) {
        // Prevent duplicate active invites for the same email
        const existing = await this.databaseService.onboarding.findFirst({
            where: {
                email: dto.email,
                completedAt: null,
                expiresAt: { gt: new Date() },
            },
        });
        if (existing) throw new BadRequestException('An active onboarding invite already exists for this email.');

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

        return this.databaseService.onboarding.create({
            data: {
                ...dto,
                token,
                expiresAt,
            },
        });
    }

    // ADMIN: Get all onboardings (paginated, all statuses)
    async getAllOnboardings(filters: QueryString) {
        const apiFeatures = new PrismaApiFeatures<
            Prisma.OnboardingWhereInput,
            Prisma.OnboardingInclude,
            Prisma.OnboardingOrderByWithRelationInput,
            typeof this.databaseService.onboarding
        >(this.databaseService.onboarding, filters)
            .search(['email'])
            .filter()
            .sort()
            .include({ provider: true })
            .pagination();

        const { results, totalCount } = await apiFeatures.execute();

        return {
            success: true,
            count: results.length,
            totalCount,
            totalPages: Math.ceil(totalCount / (Number(filters.limit) || 10)),
            data: results,
        };
    }

    // ADMIN: Get pending onboardings only
    async getPendingOnboardings() {
        return this.databaseService.onboarding.findMany({
            where: {
                completedAt: null,
                expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    // ADMIN: Revoke onboarding invite (marks as expired immediately)
    async revokeOnboardingInvite(id: string) {
        const onboarding = await this.databaseService.onboarding.findUnique({
            where: { id },
        });
        if (!onboarding) throw new NotFoundException('Onboarding invite not found');
        if (onboarding.completedAt) throw new BadRequestException('Cannot revoke a completed onboarding invite');

        await this.databaseService.onboarding.update({
            where: { id },
            data: { expiresAt: new Date() }, // expire immediately
        });

        return { message: 'Onboarding invite revoked successfully' };
    }

    // ADMIN: Resend / extend onboarding invite
    async resendOnboardingInvite(id: string) {
        const onboarding = await this.databaseService.onboarding.findUnique({
            where: { id },
        });
        if (!onboarding) throw new NotFoundException('Onboarding invite not found');
        if (onboarding.completedAt) throw new BadRequestException('Cannot resend a completed onboarding invite');

        // Regenerate token and extend expiry by 7 days from now
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        const updated = await this.databaseService.onboarding.update({
            where: { id },
            data: { token, expiresAt },
        });

        return { message: 'Onboarding invite resent successfully', data: updated };
    }

    // ADMIN: Get onboarding by provider ID
    async getOnboardingByProvider(providerId: string) {
        const onboarding = await this.databaseService.onboarding.findFirst({
            where: { providerId },
            include: { provider: true },
        });
        if (!onboarding) throw new NotFoundException('No onboarding record found for this provider');
        return onboarding;
    }

    // ─────────────────────────────────────────────
    // USER / PUBLIC
    // ─────────────────────────────────────────────

    // PUBLIC: Get onboarding details by token (for pre-filling the form)
    async getOnboardingByToken(token: string) {
        return this.validateOnboardingToken(token);
    }

    // USER: Complete onboarding using token
    async completeOnboarding(dto: CompleteOnboardingDto, userId: string) {
        const onboarding = await this.validateOnboardingToken(dto.token);

        const user = await this.databaseService.user.findUnique({
            where: { id: userId },
        });
        if (!user) throw new NotFoundException('User not found');
        if (user.isDeleted) throw new ForbiddenException('Account has been deleted');
        if (!user.isVerified) throw new ForbiddenException('Please verify your email before completing onboarding');

        if (user.email !== onboarding.email) {
            throw new BadRequestException('Your email does not match this onboarding invite');
        }

        const provider = await this.createProviderForUser(
            userId,
            onboarding.providerType,
            dto.name,
            dto.contactNumber,
            onboarding.id,
            dto.metadata,
        );

        return {
            message: 'Onboarding completed successfully',
            data: provider,
        };
    }

    /**
     * Check if email has a pending onboarding invite and auto-complete if possible.
     * Called internally by AuthService during verifyOtp.
     * Returns provider if created, onboarding token if manual completion needed, null if no invite.
     */
    async checkAndCompleteOnboardingByEmail(
        email: string,
        userId: string,
        name?: string,
        contactNumber?: string,
    ) {
        const onboarding = await this.databaseService.onboarding.findFirst({
            where: {
                email,
                completedAt: null,
                expiresAt: { gt: new Date() },
            },
        });
        if (!onboarding) return null;

        // Can't auto-complete without name and contactNumber
        if (!name || !contactNumber) {
            return {
                requiresCompletion: true,
                onboardingToken: onboarding.token,
            };
        }

        const provider = await this.createProviderForUser(
            userId,
            onboarding.providerType,
            name,
            contactNumber,
            onboarding.id,
        );

        return { provider, onboarding };
    }
}