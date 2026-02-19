import {
    Controller, Post, Get, Patch, Delete,
    Body, Param, Query, UseGuards, BadRequestException,
} from '@nestjs/common';
import { LocalGuideService } from './local-guide.service';
import { CreateLocalGuideDto } from './dto/create-local-guide.dto';
import { AuthGuard, getUser } from 'src/modules/auth/guards/auth.guard';
import { RoleGuard } from 'src/modules/auth/guards/role.guard';
import { Roles } from 'src/modules/auth/decorator/role.decorator';
import { UserRole } from 'generated/prisma/enums';
import { QueryString } from 'src/utils/apiFeatures';

@Controller('local-guide')
export class LocalGuideController {
    constructor(private readonly localGuideService: LocalGuideService) { }

    @Post()
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.GUIDE)
    createGuide(
        @Body() dto: CreateLocalGuideDto,
        @getUser('id') userId: string,
    ) {
        return this.localGuideService.createGuide(userId, dto);
    }

    @Get()
    getGuides(@Query() query: QueryString) {
        return this.localGuideService.getGuides(query);
    }

    @Get('nearby')
    getNearbyGuides(
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
        return this.localGuideService.getNearbyGuides(lat, lng, radius ? parseFloat(radius) : 30);
    }

    @Get('provider/my-guides')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.GUIDE)
    getMyGuides(@getUser('id') userId: string) {
        return this.localGuideService.getMyGuides(userId);
    }

    @Get(':id')
    getGuide(@Param('id') id: string) {
        return this.localGuideService.getGuide(id);
    }

    @Patch(':id')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.GUIDE)
    updateGuide(
        @Param('id') id: string,
        @Body() dto: Partial<CreateLocalGuideDto>,
        @getUser('id') userId: string,
    ) {
        return this.localGuideService.updateGuide(id, userId, dto);
    }

    @Delete(':id')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.GUIDE)
    deleteGuide(
        @Param('id') id: string,
        @getUser('id') userId: string,
    ) {
        return this.localGuideService.deleteGuide(id, userId);
    }
}