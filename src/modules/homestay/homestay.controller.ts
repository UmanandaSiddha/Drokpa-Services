import {
    Controller, Post, Get, Patch, Delete,
    Body, Param, Query, UseGuards, BadRequestException,
} from '@nestjs/common';
import { HomestayService } from './homestay.service';
import { CreateHomestayDto } from './dto/create-homestay.dto';
import { AuthGuard, getUser } from 'src/modules/auth/guards/auth.guard';
import { RoleGuard } from 'src/modules/auth/guards/role.guard';
import { Roles } from 'src/modules/auth/decorator/role.decorator';
import { UserRole } from 'generated/prisma/enums';
import { QueryString } from 'src/utils/apiFeatures';

@Controller('homestay')
export class HomestayController {
    constructor(private readonly homestayService: HomestayService) { }

    @Post()
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.HOST)
    createHomestay(
        @Body() dto: CreateHomestayDto,
        @getUser('id') userId: string,
    ) {
        return this.homestayService.createHomestay(userId, dto);
    }

    @Get()
    getHomestays(@Query() query: QueryString) {
        return this.homestayService.getHomestays(query);
    }

    // Must be above GET :id to avoid route collision
    @Get('nearby')
    getNearbyHomestays(
        @Query('latitude') latitude?: string,
        @Query('longitude') longitude?: string,
        @Query('radius') radius?: string,
    ) {
        if (!latitude || !longitude) {
            throw new BadRequestException('latitude and longitude are required');
        }

        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);

        if (isNaN(lat) || isNaN(lng)) {
            throw new BadRequestException('latitude and longitude must be valid numbers');
        }

        return this.homestayService.getNearbyHomestays(lat, lng, radius ? parseFloat(radius) : 20);
    }

    // Must be above GET :id to avoid route collision
    @Get('provider/my-homestays')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.HOST)
    getProviderHomestays(@getUser('id') userId: string) {
        return this.homestayService.getProviderHomestays(userId);
    }

    @Get(':id')
    getHomestay(
        @Param('id') id: string,
        @Query('checkIn') checkIn?: string,
        @Query('checkOut') checkOut?: string,
    ) {
        return this.homestayService.getHomestay(id, {
            checkIn: checkIn ? new Date(checkIn) : undefined,
            checkOut: checkOut ? new Date(checkOut) : undefined,
        });
    }

    @Patch(':id')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.HOST)
    updateHomestay(
        @Param('id') id: string,
        @Body() dto: Partial<CreateHomestayDto>,
        @getUser('id') userId: string,
    ) {
        return this.homestayService.updateHomestay(id, userId, dto);
    }

    @Post(':id/tags')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.HOST)
    addTagsToHomestay(
        @Param('id') homestayId: string,
        @Body() body: { tagIds: string[] },
        @getUser('id') userId: string,
    ) {
        return this.homestayService.addTagsToHomestay(homestayId, body.tagIds, userId);
    }

    @Delete(':id/tags/:tagId')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.HOST)
    removeTagFromHomestay(
        @Param('id') homestayId: string,
        @Param('tagId') tagId: string,
        @getUser('id') userId: string,
    ) {
        return this.homestayService.removeTagFromHomestay(homestayId, tagId, userId);
    }

    @Post(':id/facilities')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.HOST)
    addFacilitiesToHomestay(
        @Param('id') homestayId: string,
        @Body() body: { facilityIds: string[] },
        @getUser('id') userId: string,
    ) {
        return this.homestayService.addFacilitiesToHomestay(homestayId, body.facilityIds, userId);
    }

    @Delete(':id/facilities/:facilityId')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.HOST)
    removeFacilityFromHomestay(
        @Param('id') homestayId: string,
        @Param('facilityId') facilityId: string,
        @getUser('id') userId: string,
    ) {
        return this.homestayService.removeFacilityFromHomestay(homestayId, facilityId, userId);
    }
}