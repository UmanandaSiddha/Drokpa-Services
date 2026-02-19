import {
    Body, Controller, Delete, Get,
    Param, ParseIntPipe, Patch, Post,
    Query, UseGuards,
} from '@nestjs/common';
import { UserRole } from 'generated/prisma/enums';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RoleGuard } from '../auth/guards/role.guard';
import { Roles } from '../auth/decorator/role.decorator';
import { ToursService } from './tours.service';
import { CreateTourDto } from './dto/create-tour.dto';
import { AddItineraryDto } from './dto/add-itinerary.dto';
import { QueryString } from 'src/utils/apiFeatures';

@Controller('tours')
export class ToursController {
    constructor(private readonly toursService: ToursService) { }

    @Post()
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    createTour(@Body() dto: CreateTourDto) {
        return this.toursService.createTour(dto);
    }

    @Get()
    listActiveTours(@Query() query: QueryString) {
        return this.toursService.listActiveTours(query);
    }

    @Get(':id')
    getTourById(@Param('id') id: string) {
        return this.toursService.getTourById(id);
    }

    @Patch(':id')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    updateTourById(@Param('id') id: string, @Body() dto: Partial<CreateTourDto>) {
        return this.toursService.updateTourById(id, dto);
    }

    @Delete(':id')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    deactivateTour(@Param('id') id: string) {
        return this.toursService.deactivateTour(id);
    }

    @Post(':id/itinerary')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    addTourItineraryDay(@Param('id') id: string, @Body() dto: AddItineraryDto) {
        return this.toursService.addTourItineraryDay(id, dto);
    }

    @Post('itinerary/:itineraryId/poi/:poiId')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    addPoiToItinerary(
        @Param('itineraryId') itineraryId: string,
        @Param('poiId') poiId: string,
        @Body('order', ParseIntPipe) order: number,
    ) {
        return this.toursService.addPoiToItinerary(itineraryId, poiId, order);
    }

    @Patch('itinerary/:itineraryId/reorder')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    reorderItineraryPois(
        @Param('itineraryId') itineraryId: string,
        @Body('poiIds') poiIds: string[],
    ) {
        return this.toursService.reorderItineraryPois(itineraryId, poiIds);
    }
}