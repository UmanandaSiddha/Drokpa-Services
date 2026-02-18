import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/services/database/database.service';
import { PrismaApiFeatures, QueryString } from 'src/utils/apiFeatures';
import { UserDetailsDto } from './dto/details.dto';
import { ProfileDto } from './dto/profile.dto';
import { Gender } from 'generated/prisma/enums';
import { Prisma } from 'generated/prisma/client';
import { AuthService } from '../auth/auth.service';
import { SAFE_USER_SELECT } from 'src/utils/auth.helper';

@Injectable()
export class UserService {

    constructor(
        private readonly databaseService: DatabaseService,
        private readonly authService: AuthService
    ) { }

    // ─────────────────────────────────────────────
    // ADMIN
    // ─────────────────────────────────────────────

    // ADMIN: Get User by ID
    async getUserById(userId: string) {
        const user = await this.databaseService.user.findUnique({
            where: { id: userId },
            select: {
                ...SAFE_USER_SELECT,
                roles: true,
                provider: true,
            },
        });
        if (!user) throw new BadRequestException('User not found');
        return user;
    }

    // ADMIN: Get All Users
    async getAllUsers(filters: QueryString) {
        const apiFeatures = new PrismaApiFeatures<
            Prisma.UserWhereInput,
            Prisma.UserInclude,
            Prisma.UserOrderByWithRelationInput,
            typeof this.databaseService.user
        >(this.databaseService.user, filters)
            .search(['firstName', 'lastName', 'email'])
            .filter()
            .sort()
            .include({
                roles: true,
                provider: true
            })
            .pagination();

        const { results: users, totalCount } = await apiFeatures.execute();

        const safeUsers = users.map(({ passwordHash, oneTimePassword, resetToken, resetTokenExpire, oneTimeExpire, ...user }: any) => user);

        return {
            success: true,
            count: safeUsers.length,
            totalCount,
            totalPages: Math.ceil(totalCount / (Number(filters.limit) || 10)),
            data: safeUsers,
        }
    }

    // ADMIN: Delete User by ID
    async deleteUser(userId: string) {
        const user = await this.databaseService.user.findUnique({
            where: { id: userId },
        });
        if (!user) throw new BadRequestException(`User not found with ID ${userId}`);

        // await this.databaseService.user.delete({
        //     where: { id: userId },
        // });

        // Implementing soft delete
        await this.databaseService.user.update({
            where: { id: userId },
            data: { isDeleted: true, deletedAt: new Date() }
        });

        await this.databaseService.session.deleteMany({ where: { userId } });

        // TODO: Clean up S3 assets (avatarUrl, documents)

        return { message: 'User deleted successfully' };
    }

    // ADMIN: Toggle user disabled status
    async toggleUserStatus(userId: string) {
        const user = await this.databaseService.user.findUnique({
            where: { id: userId },
        });
        if (!user) throw new BadRequestException('User not found');

        const updatedUser = await this.databaseService.user.update({
            where: { id: userId },
            data: { isDisabled: !user.isDisabled },
            select: SAFE_USER_SELECT,
        });

        // If disabling, invalidate all sessions immediately
        if (updatedUser.isDisabled) {
            await this.databaseService.session.deleteMany({ where: { userId } });
        }

        return {
            message: `User ${updatedUser.isDisabled ? 'disabled' : 'enabled'} successfully`,
            data: updatedUser,
        };
    }

    // ADMIN: Manually verify a user
    async verifyUser(userId: string) {
        const user = await this.databaseService.user.findUnique({
            where: { id: userId },
        });
        if (!user) throw new BadRequestException('User not found');
        if (user.isVerified) throw new BadRequestException('User is already verified');

        const updatedUser = await this.databaseService.user.update({
            where: { id: userId },
            data: {
                isVerified: true,
                oneTimePassword: null,
                oneTimeExpire: null,
            },
            select: SAFE_USER_SELECT,
        });

        return { message: 'User verified successfully', data: updatedUser };
    }

    // ─────────────────────────────────────────────
    // USER
    // ─────────────────────────────────────────────

    // USER: Get User Profile (no bookings — fetched separately)
    async userProfile(userId: string) {
        const user = await this.databaseService.user.findUnique({
            where: { id: userId, isDeleted: false },
            select: {
                ...SAFE_USER_SELECT,
                roles: true,
                provider: {
                    select: {
                        id: true,
                        name: true,
                        type: true,
                        status: true,
                        verified: true,
                    },
                },
            },
        });
        if (!user) throw new BadRequestException('User not found');
        return { message: 'User profile fetched successfully', data: user };
    }

    // USER: Update User Email
    async updateUserDetails(userId: string, dto: UserDetailsDto) {
        const user = await this.databaseService.user.findUnique({
            where: { id: userId, isDeleted: false },
        });
        if (!user) throw new BadRequestException('User not found');

        // Check if new email is already taken
        if (dto.email !== user.email) {
            const existing = await this.databaseService.user.findUnique({
                where: { email: dto.email },
            });
            if (existing && !existing.isDeleted) throw new BadRequestException('Email already in use');
        }

        const updatedUser = await this.databaseService.user.update({
            where: { id: userId, isDeleted: false },
            data: {
                email: dto.email,
                isVerified: false,
            },
            select: SAFE_USER_SELECT,
        });

        // Invalidate all sessions — user must re-login after verifying new email
        await this.databaseService.session.deleteMany({ where: { userId } });

        // Send OTP to new email for re-verification
        await this.authService.requestOtp({ email: updatedUser.email });

        return {
            message: 'Email updated. Please verify your new email address.',
            data: updatedUser,
        };
    }

    // USER: Update User Profile
    async updateProfile(dto: ProfileDto, userId: string) {
        const { firstName, lastName, gender, dateOfBirth, avatarUrl, phoneNumber } = dto;

        const user = await this.databaseService.user.findUnique({
            where: { id: userId, isDeleted: false },
        });
        if (!user) throw new BadRequestException('User not found');

        const updatedUser = await this.databaseService.user.update({
            where: { id: userId },
            data: {
                ...(firstName !== undefined && { firstName }),
                ...(lastName !== undefined && { lastName }),
                ...(gender !== undefined && { gender: gender as Gender }),
                ...(dateOfBirth !== undefined && { dateOfBirth: new Date(dateOfBirth) }),
                ...(avatarUrl !== undefined && { avatarUrl }),
                ...(phoneNumber !== undefined && { phoneNumber }),
            },
            select: SAFE_USER_SELECT,
        });

        return { message: 'Profile updated successfully', data: updatedUser };
    }

    // USER: Update Notification Preferences
    async updateNotificationPreferences(userId: string, preferences: Record<string, any>) {
        const user = await this.databaseService.user.findUnique({
            where: { id: userId, isDeleted: false },
        });
        if (!user) throw new BadRequestException('User not found');

        // Merge with existing preferences rather than replacing entirely
        const existing = (user.notificationPreferences as Record<string, any>) || {};
        const merged = { ...existing, ...preferences };

        const updatedUser = await this.databaseService.user.update({
            where: { id: userId },
            data: { notificationPreferences: merged },
            select: { id: true, notificationPreferences: true },
        });

        return { message: 'Notification preferences updated', data: updatedUser };
    }

    // USER: Get User Bookings (paginated)
    async getUserBookings(userId: string, filters: QueryString) {
        const page = Number(filters.page) || 1;
        const limit = Number(filters.limit) || 10;
        const skip = (page - 1) * limit;

        const [bookings, totalCount] = await Promise.all([
            this.databaseService.booking.findMany({
                where: { userId },
                include: {
                    items: {
                        include: {
                            guests: true,
                            rooms: true,
                        },
                    },
                    payment: true,
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.databaseService.booking.count({ where: { userId } }),
        ]);

        return {
            success: true,
            count: bookings.length,
            totalCount,
            totalPages: Math.ceil(totalCount / limit),
            data: bookings,
        };
    }

    // USER: Get User Reviews
    async getUserReviews(userId: string) {
        const reviews = await this.databaseService.review.findMany({
            where: { userId },
            include: {
                tour: {
                    select: { id: true, title: true, imageUrls: true },
                },
                homestay: {
                    select: { id: true, name: true, imageUrls: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        return {
            success: true,
            count: reviews.length,
            data: reviews,
        };
    }

    // USER: Get User Bucket Lists
    async getUserBucketLists(userId: string) {
        const bucketLists = await this.databaseService.bucketList.findMany({
            where: { userId },
            include: {
                items: {
                    include: {
                        tour: {
                            select: { id: true, title: true, imageUrls: true, finalPrice: true },
                        },
                        homestay: {
                            select: { id: true, name: true, imageUrls: true, displayPrice: true },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        return {
            success: true,
            count: bucketLists.length,
            data: bucketLists,
        };
    }

    // USER: Delete Own Account
    async deleteAccount(userId: string) {
        const user = await this.databaseService.user.findUnique({
            where: { id: userId },
        });
        if (!user) throw new BadRequestException('User not found');

        // Check for active/confirmed bookings before deleting
        const activeBookings = await this.databaseService.booking.findFirst({
            where: {
                userId,
                status: { in: ['CONFIRMED', 'AWAITING_PAYMENT', 'REQUESTED'] },
            },
        });
        if (activeBookings) {
            throw new BadRequestException('Cannot delete account with active bookings. Please cancel them first.');
        }

        // await this.databaseService.user.delete({ where: { id: userId } });

        // Implementing soft delete
        await this.databaseService.user.update({
            where: { id: userId },
            data: { isDeleted: true, deletedAt: new Date() }
        });

        await this.databaseService.session.deleteMany({ where: { userId } });

        // TODO: Clean up S3 assets (avatarUrl, documents)

        return { message: 'Account deleted successfully' };
    }
}