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
    create(@Body() dto: CreateTourDto) {
        return this.toursService.create(dto);
    }

    @Get()
    findAll() {
        return this.toursService.findAll();
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.toursService.findOne(id);
    }

    @Patch(':id')
    @UseGuards(AuthGuard, RoleGuard)
    update(@Param('id') id: string, @Body() dto: Partial<CreateTourDto>) {
        return this.toursService.update(id, dto);
    }

    @Delete(':id')
    @UseGuards(AuthGuard, RoleGuard)
    remove(@Param('id') id: string) {
        return this.toursService.remove(id);
    }

    @Post(':id/itinerary')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    addItinerary(@Param('id') id: string, @Body() dto: AddItineraryDto) {
        return this.toursService.addItinerary(id, dto);
    }

    @Post('itinerary/:itineraryId/poi/:poiId')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    linkPOIToItinerary(
        @Param('itineraryId') itineraryId: string,
        @Param('poiId') poiId: string,
        @Body('order') order: number,
    ) {
        return this.toursService.linkPOIToItinerary(itineraryId, poiId, order);
    }
}