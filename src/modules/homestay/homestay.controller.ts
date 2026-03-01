import {
    Controller, Post, Get, Patch, Delete,
    Body, Param, Query, UseGuards, BadRequestException,
} from '@nestjs/common';
import { HomestayService } from './homestay.service';
import { CreateHomestayDto } from './dto/create-homestay.dto';
import { CreateHomestayRoomDto } from './dto/create-room.dto';
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
    @Roles(UserRole.HOST, UserRole.ADMIN)
    createHomestay(
        @Body() dto: CreateHomestayDto,
        @getUser('id') userId: string,
        @getUser('roles') userRoles: { role: UserRole }[],
        @Query('onBehalfOf') onBehalfOf?: string,
    ) {
        const isAdmin = userRoles.some(r => r.role === UserRole.ADMIN);
        // Admin must supply ?onBehalfOf=<hostUserId> to associate with the correct provider
        if (isAdmin && !onBehalfOf) {
            throw new BadRequestException('Admin must supply ?onBehalfOf=<hostUserId> to create a homestay on behalf of a provider');
        }
        const effectiveUserId = isAdmin ? onBehalfOf! : userId;
        return this.homestayService.createHomestay(effectiveUserId, dto);
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

    @Get('slug/:slug')
    getHomestayBySlug(
        @Param('slug') slug: string,
        @Query('checkIn') checkIn?: string,
        @Query('checkOut') checkOut?: string,
    ) {
        return this.homestayService.getHomestayBySlug(slug, {
            checkIn: checkIn ? new Date(checkIn) : undefined,
            checkOut: checkOut ? new Date(checkOut) : undefined,
        });
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
    @Roles(UserRole.HOST, UserRole.ADMIN)
    updateHomestay(
        @Param('id') id: string,
        @Body() dto: Partial<CreateHomestayDto>,
        @getUser('id') userId: string,
        @getUser('roles') userRoles: { role: UserRole }[],
    ) {
        const isAdmin = userRoles.some(r => r.role === UserRole.ADMIN);
        return this.homestayService.updateHomestay(id, userId, dto, isAdmin);
    }

    @Delete(':id')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.HOST, UserRole.ADMIN)
    deleteHomestay(
        @Param('id') id: string,
        @getUser('id') userId: string,
        @getUser('roles') userRoles: { role: UserRole }[],
    ) {
        const isAdmin = userRoles.some(r => r.role === UserRole.ADMIN);
        return this.homestayService.deleteHomestay(id, userId, isAdmin);
    }

    @Post(':id/tags')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.HOST, UserRole.ADMIN)
    addTagsToHomestay(
        @Param('id') homestayId: string,
        @Body() body: { tagIds: string[] },
        @getUser('id') userId: string,
        @getUser('roles') userRoles: { role: UserRole }[],
    ) {
        const isAdmin = userRoles.some(r => r.role === UserRole.ADMIN);
        return this.homestayService.addTagsToHomestay(homestayId, body.tagIds, userId, isAdmin);
    }

    @Delete(':id/tags/:tagId')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.HOST, UserRole.ADMIN)
    removeTagFromHomestay(
        @Param('id') homestayId: string,
        @Param('tagId') tagId: string,
        @getUser('id') userId: string,
        @getUser('roles') userRoles: { role: UserRole }[],
    ) {
        const isAdmin = userRoles.some(r => r.role === UserRole.ADMIN);
        return this.homestayService.removeTagFromHomestay(homestayId, tagId, userId, isAdmin);
    }

    @Post(':id/facilities')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.HOST, UserRole.ADMIN)
    addFacilitiesToHomestay(
        @Param('id') homestayId: string,
        @Body() body: { facilityIds: string[] },
        @getUser('id') userId: string,
        @getUser('roles') userRoles: { role: UserRole }[],
    ) {
        const isAdmin = userRoles.some(r => r.role === UserRole.ADMIN);
        return this.homestayService.addFacilitiesToHomestay(homestayId, body.facilityIds, userId, isAdmin);
    }

    @Delete(':id/facilities/:facilityId')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.HOST, UserRole.ADMIN)
    removeFacilityFromHomestay(
        @Param('id') homestayId: string,
        @Param('facilityId') facilityId: string,
        @getUser('id') userId: string,
        @getUser('roles') userRoles: { role: UserRole }[],
    ) {
        const isAdmin = userRoles.some(r => r.role === UserRole.ADMIN);
        return this.homestayService.removeFacilityFromHomestay(homestayId, facilityId, userId, isAdmin);
    }

    @Post(':id/room')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.HOST, UserRole.ADMIN)
    createRoom(
        @Param('id') homestayId: string,
        @Body() dto: CreateHomestayRoomDto,
        @getUser('id') userId: string,
        @getUser('roles') userRoles: { role: UserRole }[],
    ) {
        const isAdmin = userRoles.some(r => r.role === UserRole.ADMIN);
        return this.homestayService.createRoom(homestayId, userId, dto, isAdmin);
    }

    @Get(':id/rooms')
    getRooms(@Param('id') homestayId: string) {
        return this.homestayService.getRooms(homestayId);
    }

    @Patch(':homestayId/room/:roomId')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.HOST, UserRole.ADMIN)
    updateRoom(
        @Param('homestayId') homestayId: string,
        @Param('roomId') roomId: string,
        @Body() dto: Partial<CreateHomestayRoomDto>,
        @getUser('id') userId: string,
        @getUser('roles') userRoles: { role: UserRole }[],
    ) {
        const isAdmin = userRoles.some(r => r.role === UserRole.ADMIN);
        return this.homestayService.updateRoom(homestayId, roomId, userId, dto, isAdmin);
    }

    @Delete(':homestayId/room/:roomId')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.HOST, UserRole.ADMIN)
    deleteRoom(
        @Param('homestayId') homestayId: string,
        @Param('roomId') roomId: string,
        @getUser('id') userId: string,
        @getUser('roles') userRoles: { role: UserRole }[],
    ) {
        const isAdmin = userRoles.some(r => r.role === UserRole.ADMIN);
        return this.homestayService.deleteRoom(homestayId, roomId, userId, isAdmin);
    }
}