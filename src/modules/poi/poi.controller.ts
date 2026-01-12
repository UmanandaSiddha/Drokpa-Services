import { Controller, Post, Get, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { POIService } from './poi.service';
import { CreatePOIDto } from './dto/create-poi.dto';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { RoleGuard } from 'src/modules/auth/guards/role.guard';
import { Roles } from 'src/modules/auth/decorator/role.decorator';
import { UserRole } from 'generated/prisma/enums';

@Controller('poi')
export class POIController {
    constructor(private readonly poiService: POIService) { }

    @Post()
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    createPOI(@Body() dto: CreatePOIDto) {
        return this.poiService.createPOI(dto);
    }

    @Get()
    getPOIs(@Query('name') name?: string) {
        return this.poiService.getPOIs({ name });
    }

    @Get('nearby')
    getNearbyPOIs(
        @Query('latitude') latitude: string,
        @Query('longitude') longitude: string,
        @Query('radius') radius?: string,
    ) {
        return this.poiService.getNearbyPOIs(
            parseFloat(latitude),
            parseFloat(longitude),
            radius ? parseFloat(radius) : 10,
        );
    }

    @Get(':id')
    getPOI(@Param('id') id: string) {
        return this.poiService.getPOI(id);
    }

    @Put(':id')
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
        @Query('order') order: string,
    ) {
        return this.poiService.linkToItinerary(id, itineraryId, parseInt(order));
    }
}
