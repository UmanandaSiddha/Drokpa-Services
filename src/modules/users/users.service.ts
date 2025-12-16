import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/services/database/database.service';
import { PrismaApiFeatures, QueryString } from 'src/utils/apiFeatures';
import { UserDetailsDto } from './dto/details.dto';
import { ProfileDto } from './dto/profile.dto';
import { Gender } from 'generated/prisma/enums';
import { Prisma } from 'generated/prisma/client';

@Injectable()
export class UserService {

    constructor(
        private readonly databaseService: DatabaseService,
    ) { }

    // ADMIN: Get User by ID
    async getUserById(userId: string) {
        const user = await this.databaseService.user.findUnique({
            where: { id: userId },
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
                bookings: true,
                providerProfile: true
            })
            .pagination();

        const { results: users, totalCount } = await apiFeatures.execute();

        return {
            success: true,
            count: users.length,
            totalCount,
            totalPages: Math.ceil(totalCount / (Number(filters.limit) || 10)),
            data: users,
        }
    }

    // ADMIN: Delete User by ID
    async deleteUser(userId: string) {
        const user = await this.databaseService.user.findUnique({
            where: { id: userId },
        });
        if (!user) throw new BadRequestException(`User not found with ID ${userId}`);

        await this.databaseService.user.delete({
            where: { id: userId },
        });
        return { message: 'User deleted successfully' };
    }

    // USER: Update User Email and PhoneNumber
    async updateUserDetails(userId: string, dto: UserDetailsDto) {
        const user = await this.databaseService.user.findUnique({
            where: { id: userId },
        });
        if (!user) throw new BadRequestException('User not found');

        const updatedUser = await this.databaseService.user.update({
            where: { id: userId },
            data: {
                email: dto.email,
                isVerified: false,
            },
        });
        if (!updatedUser) throw new BadRequestException('Failed to update user details');

        return updatedUser;
    }

    // USER: Get User Profile
    async userProfile(userId: string) {
        try {
            const user = await this.databaseService.user.findFirst({
                where: { id: userId },
                omit: { passwordHash: true },
                include: {
                    roles: true,
                    bookings: true,
                    providerProfile: true
                }
            });
            if (!user) throw new BadRequestException('User not found');

            return { message: 'User profile fetched successfully!!', data: user };
        } catch (error) {
            return { message: 'Failed to fetch/update user profile', error: error.message };
        }
    }

    // USER: Update User Profile
    async updateProfile(dto: ProfileDto, userId: string) {
        const { firstName, lastName, gender, dateOfBirth, avatarUrl } = dto;

        const newUser = await this.databaseService.user.upsert({
            where: { id: userId },
            create: {
                id: userId,
                firstName,
                lastName,
                ...(gender && { gender: gender as Gender }),
                ...(dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }),
                ...(avatarUrl && { avatarUrl }),
            },
            update: {
                ...(firstName && { firstName }),
                ...(lastName && { lastName }),
                ...(gender && { gender: gender as Gender }),
                ...(dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }),
                ...(avatarUrl && { avatarUrl }),
            },
        });

        return { message: 'Profile updated successfully!', data: newUser };
    }
}