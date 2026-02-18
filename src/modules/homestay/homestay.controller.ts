import { Controller, Post, Get, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { HomestayService } from './homestay.service';
import { CreateHomestayDto } from './dto/create-homestay.dto';
import { AuthGuard, getUser } from 'src/modules/auth/guards/auth.guard';
import { RoleGuard } from 'src/modules/auth/guards/role.guard';
import { Roles } from 'src/modules/auth/decorator/role.decorator';
import { UserRole } from 'generated/prisma/enums';

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
    getHomestays(
        @Query('isActive') isActive?: string,
        @Query('providerId') providerId?: string,
    ) {
        return this.homestayService.getHomestays({
            isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
            providerId,
        });
    }

    @Get('nearby')
    getNearbyHomestays(
        @Query('latitude') latitude: string,
        @Query('longitude') longitude: string,
        @Query('radius') radius?: string,
    ) {
        return this.homestayService.getNearbyHomestays(
            parseFloat(latitude),
            parseFloat(longitude),
            radius ? parseFloat(radius) : 20,
        );
    }

    @Get('provider/my-homestays')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.HOST)
    getProviderHomestays(@getUser('providerId') providerId: string) {
        return this.homestayService.getProviderHomestays(providerId);
    }

    @Post(':id/tags')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.HOST)
    addTagsToHomestay(
        @Param('id') homestayId: string,
        @Body() body: { tagIds: string[] },
        @getUser('providerId') providerId: string,
    ) {
        return this.homestayService.addTagsToHomestay(homestayId, body.tagIds, providerId);
    }

    @Delete(':id/tags/:tagId')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.HOST)
    removeTagFromHomestay(
        @Param('id') homestayId: string,
        @Param('tagId') tagId: string,
        @getUser('providerId') providerId: string,
    ) {
        return this.homestayService.removeTagFromHomestay(homestayId, tagId, providerId);
    }

    @Post(':id/facilities')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.HOST)
    addFacilitiesToHomestay(
        @Param('id') homestayId: string,
        @Body() body: { facilityIds: string[] },
        @getUser('providerId') providerId: string,
    ) {
        return this.homestayService.addFacilitiesToHomestay(homestayId, body.facilityIds, providerId);
    }

    @Delete(':id/facilities/:facilityId')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.HOST)
    removeFacilityFromHomestay(
        @Param('id') homestayId: string,
        @Param('facilityId') facilityId: string,
        @getUser('providerId') providerId: string,
    ) {
        return this.homestayService.removeFacilityFromHomestay(homestayId, facilityId, providerId);
    }

    @Get(':id')
    getHomestay(@Param('id') id: string) {
        return this.homestayService.getHomestay(id);
    }

    @Put(':id')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.HOST)
    updateHomestay(
        @Param('id') id: string,
        @Body() dto: Partial<CreateHomestayDto>,
        @getUser('providerId') providerId: string,
    ) {
        return this.homestayService.updateHomestay(id, providerId, dto);
    }
}
