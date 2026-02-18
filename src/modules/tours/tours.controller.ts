import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ToursService } from "./tours.service";
import { AuthGuard, getUser } from "../auth/guards/auth.guard";
import { RoleGuard } from "../auth/guards/role.guard";
import { Roles } from "../auth/decorator/role.decorator";
import { UserRole } from "generated/prisma/enums";
import { CreateTourDto } from "./dto/create-tour.dto";
import { AddItineraryDto } from "./dto/add-itinerary.dto";

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
    listActiveTours() {
        return this.toursService.listActiveTours();
    }

    @Get(':id')
    getTourById(@Param('id') id: string) {
        return this.toursService.getTourById(id);
    }

    @Patch(':id')
    @UseGuards(AuthGuard, RoleGuard)
    updateTourById(@Param('id') id: string, @Body() dto: Partial<CreateTourDto>) {
        return this.toursService.updateTourById(id, dto);
    }

    @Delete(':id')
    @UseGuards(AuthGuard, RoleGuard)
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
        @Body('order') order: number,
    ) {
        return this.toursService.addPoiToItinerary(itineraryId, poiId, order);
    }
}