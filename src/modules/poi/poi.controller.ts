import {
    BadRequestException, Controller, Post, Get,
    Patch, Delete, Body, Param, Query,
    UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { POIService } from './poi.service';
import { CreatePOIDto } from './dto/create-poi.dto';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { RoleGuard } from 'src/modules/auth/guards/role.guard';
import { Roles } from 'src/modules/auth/decorator/role.decorator';
import { UserRole } from 'generated/prisma/enums';
import { QueryString } from 'src/utils/apiFeatures';

@Controller('poi')
export class POIController {
    constructor(private readonly poiService: POIService) { }

    @Post()
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    createPOI(@Body() dto: CreatePOIDto) {
        return this.poiService.createPOI(dto);
    }

    // Static GET routes above :id
    @Get()
    getPOIs(@Query() query: QueryString) {
        return this.poiService.getPOIs(query);
    }

    @Get('nearby')
    getNearbyPOIs(
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
        return this.poiService.getNearbyPOIs(lat, lng, radius ? parseFloat(radius) : 10);
    }

    @Get(':id')
    getPOI(@Param('id') id: string) {
        return this.poiService.getPOI(id);
    }

    @Patch(':id')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    updatePOI(
        @Param('id') id: string,
        @Body() dto: Partial<CreatePOIDto>,
    ) {
        return this.poiService.updatePOI(id, dto);
    }

    @Delete(':id')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    deletePOI(@Param('id') id: string) {
        return this.poiService.deletePOI(id);
    }

    @Post(':id/itinerary/:itineraryId')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    linkToItinerary(
        @Param('id') id: string,
        @Param('itineraryId') itineraryId: string,
        @Body('order', ParseIntPipe) order: number,
    ) {
        return this.poiService.linkToItinerary(id, itineraryId, order);
    }
}