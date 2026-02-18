import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AuthGuard, getUser } from 'src/modules/auth/guards/auth.guard';
import { RoleGuard } from '../auth/guards/role.guard';
import { UserService } from './users.service';
import { ProfileDto } from './dto/profile.dto';
import { UserDetailsDto } from './dto/details.dto';
import { Roles } from '../auth/decorator/role.decorator';
import { QueryString } from 'src/utils/apiFeatures';
import { UserRole } from 'generated/prisma/enums';

@Controller('user')
@UseGuards(AuthGuard, RoleGuard)
export class UserController {
    constructor(private readonly userService: UserService) { }

    // ─────────────────────────────────────────────
    // USER
    // ─────────────────────────────────────────────

    // GET PROFILE
    @Get('me')
    userProfile(@getUser('id') userId: string) {
        return this.userService.userProfile(userId);
    }

    // UPDATE PROFILE
    @Put('me/profile')
    updateProfile(@Body() dto: ProfileDto, @getUser('id') userId: string) {
        return this.userService.updateProfile(dto, userId);
    }

    // UPDATE EMAIL/DETAILS
    @Put('me/details')
    updateDetails(@Body() dto: UserDetailsDto, @getUser('id') userId: string) {
        return this.userService.updateUserDetails(userId, dto);
    }

    // UPDATE NOTIFICATION PREFERENCES
    @Put('me/notifications')
    updateNotificationPreferences(
        @Body() preferences: Record<string, any>,
        @getUser('id') userId: string,
    ) {
        return this.userService.updateNotificationPreferences(userId, preferences);
    }

    // GET MY BOOKINGS
    @Get('me/bookings')
    getUserBookings(@getUser('id') userId: string, @Query() filters: QueryString) {
        return this.userService.getUserBookings(userId, filters);
    }

    // GET MY REVIEWS
    @Get('me/reviews')
    getUserReviews(@getUser('id') userId: string) {
        return this.userService.getUserReviews(userId);
    }

    // GET MY BUCKET LISTS
    @Get('me/bucket-lists')
    getUserBucketLists(@getUser('id') userId: string) {
        return this.userService.getUserBucketLists(userId);
    }

    // DELETE OWN ACCOUNT
    @Delete('me')
    deleteAccount(@getUser('id') userId: string) {
        return this.userService.deleteAccount(userId);
    }

    // ─────────────────────────────────────────────
    // ADMIN
    // ─────────────────────────────────────────────

    // GET ALL USERS
    @Roles(UserRole.ADMIN)
    @Get('admin/all')
    getAllUsers(@Query() filters: QueryString) {
        return this.userService.getAllUsers(filters);
    }

    // GET USER BY ID
    @Roles(UserRole.ADMIN)
    @Get('admin/:id')
    getUserById(@Param('id') id: string) {
        return this.userService.getUserById(id);
    }

    // SOFT DELETE USER
    @Roles(UserRole.ADMIN)
    @Delete('admin/:id')
    deleteUser(@Param('id') id: string) {
        return this.userService.deleteUser(id);
    }

    // TOGGLE USER STATUS (enable/disable)
    @Roles(UserRole.ADMIN)
    @Put('admin/:id/status')
    toggleUserStatus(@Param('id') id: string) {
        return this.userService.toggleUserStatus(id);
    }

    // MANUALLY VERIFY USER
    @Roles(UserRole.ADMIN)
    @Put('admin/:id/verify')
    verifyUser(@Param('id') id: string) {
        return this.userService.verifyUser(id);
    }
}