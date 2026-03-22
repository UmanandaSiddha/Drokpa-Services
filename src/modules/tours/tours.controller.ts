import {
    BadRequestException,
    Body, Controller, Delete, Get,
    Param, ParseIntPipe, Patch, Post,
    Query, UseGuards,
} from '@nestjs/common';
import { UserRole } from 'generated/prisma/enums';
import { AuthGuard, getUser } from '../auth/guards/auth.guard';
import { RoleGuard } from '../auth/guards/role.guard';
import { Roles } from '../auth/decorator/role.decorator';
import { ToursService } from './tours.service';
import { CreateTourDto } from './dto/create-tour.dto';
import { AddItineraryDto } from './dto/add-itinerary.dto';
import { AddSuggestedTrekDto } from './dto/add-suggested-trek.dto';
import { UpdateSuggestedTrekDto } from './dto/update-suggested-trek.dto';
import { QueryString } from 'src/utils/apiFeatures';

@Controller('tours')
export class ToursController {
    constructor(private readonly toursService: ToursService) { }

    @Post()
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN, UserRole.VENDOR)
    createTour(
        @Body() dto: CreateTourDto,
        @getUser('providerId') providerId: string | undefined,
        @getUser('roles') userRoles: { role: UserRole }[],
        @Query('onBehalfOf') onBehalfOf?: string,
    ) {
        const isAdmin = userRoles.some(r => r.role === UserRole.ADMIN);
        const effectiveProviderId = isAdmin
            ? (onBehalfOf || dto.providerId)
            : providerId;

        if (!isAdmin && !effectiveProviderId) {
            throw new BadRequestException('Provider profile not found for current user');
        }

        return this.toursService.createTour(dto, effectiveProviderId);
    }

    @Get()
    listActiveTours(@Query() query: QueryString) {
        return this.toursService.listActiveTours(query);
    }

    @Get('admin/all')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    listAllTours(@Query() query: QueryString) {
        return this.toursService.listAllTours(query);
    }

    @Get('provider/my-tours')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.VENDOR)
    listMyTours(
        @Query() query: QueryString,
        @getUser('providerId') providerId: string | undefined,
    ) {
        if (!providerId) {
            throw new BadRequestException('Provider profile not found for current user');
        }
        return this.toursService.listProviderTours(providerId, query);
    }

    @Get('slug/:slug')
    getTourBySlug(@Param('slug') slug: string) {
        return this.toursService.getTourBySlug(slug);
    }

    @Get(':id/suggested-treks')
    getSuggestedTreksForTour(
        @Param('id') id: string,
        @Query('participants') participants?: string,
    ) {
        return this.toursService.getSuggestedTreksForTour(
            id,
            participants ? parseInt(participants, 10) : undefined,
        );
    }

    @Get(':id')
    getTourById(@Param('id') id: string) {
        return this.toursService.getTourById(id);
    }

    @Patch(':id')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN, UserRole.VENDOR)
    updateTourById(
        @Param('id') id: string,
        @Body() dto: Partial<CreateTourDto>,
        @getUser('providerId') providerId: string | undefined,
        @getUser('roles') userRoles: { role: UserRole }[],
    ) {
        const isAdmin = userRoles.some(r => r.role === UserRole.ADMIN);
        return this.toursService.updateTourById(id, dto, providerId, isAdmin);
    }

    @Delete(':id')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN, UserRole.VENDOR)
    deactivateTour(
        @Param('id') id: string,
        @getUser('providerId') providerId: string | undefined,
        @getUser('roles') userRoles: { role: UserRole }[],
    ) {
        const isAdmin = userRoles.some(r => r.role === UserRole.ADMIN);
        return this.toursService.deactivateTour(id, providerId, isAdmin);
    }

    @Post(':id/itinerary')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN, UserRole.VENDOR)
    addTourItineraryDay(
        @Param('id') id: string,
        @Body() dto: AddItineraryDto,
        @getUser('providerId') providerId: string | undefined,
        @getUser('roles') userRoles: { role: UserRole }[],
    ) {
        const isAdmin = userRoles.some(r => r.role === UserRole.ADMIN);
        return this.toursService.addTourItineraryDay(id, dto, providerId, isAdmin);
    }

    @Get(':id/itinerary')
    getTourItinerary(@Param('id') id: string) {
        return this.toursService.getTourItinerary(id);
    }

    @Patch(':id/itinerary/:dayNumber')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN, UserRole.VENDOR)
    updateItineraryDay(
        @Param('id') id: string,
        @Param('dayNumber', ParseIntPipe) dayNumber: number,
        @Body() dto: Partial<AddItineraryDto>,
        @getUser('providerId') providerId: string | undefined,
        @getUser('roles') userRoles: { role: UserRole }[],
    ) {
        const isAdmin = userRoles.some(r => r.role === UserRole.ADMIN);
        return this.toursService.updateItineraryDay(id, dayNumber, dto, providerId, isAdmin);
    }

    @Delete(':id/itinerary/:dayNumber')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN, UserRole.VENDOR)
    deleteItineraryDay(
        @Param('id') id: string,
        @Param('dayNumber', ParseIntPipe) dayNumber: number,
        @getUser('providerId') providerId: string | undefined,
        @getUser('roles') userRoles: { role: UserRole }[],
    ) {
        const isAdmin = userRoles.some(r => r.role === UserRole.ADMIN);
        return this.toursService.deleteItineraryDay(id, dayNumber, providerId, isAdmin);
    }

    @Post('itinerary/:itineraryId/poi/:poiId')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN, UserRole.VENDOR)
    addPoiToItinerary(
        @Param('itineraryId') itineraryId: string,
        @Param('poiId') poiId: string,
        @Body('order', ParseIntPipe) order: number,
        @getUser('providerId') providerId: string | undefined,
        @getUser('roles') userRoles: { role: UserRole }[],
    ) {
        const isAdmin = userRoles.some(r => r.role === UserRole.ADMIN);
        return this.toursService.addPoiToItinerary(itineraryId, poiId, order, providerId, isAdmin);
    }

    @Patch('itinerary/:itineraryId/reorder')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN, UserRole.VENDOR)
    reorderItineraryPois(
        @Param('itineraryId') itineraryId: string,
        @Body('poiIds') poiIds: string[],
        @getUser('providerId') providerId: string | undefined,
        @getUser('roles') userRoles: { role: UserRole }[],
    ) {
        const isAdmin = userRoles.some(r => r.role === UserRole.ADMIN);
        return this.toursService.reorderItineraryPois(itineraryId, poiIds, providerId, isAdmin);
    }

    @Delete('itinerary/:itineraryId/poi/:poiId')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN, UserRole.VENDOR)
    removePOIFromItinerary(
        @Param('itineraryId') itineraryId: string,
        @Param('poiId') poiId: string,
        @getUser('providerId') providerId: string | undefined,
        @getUser('roles') userRoles: { role: UserRole }[],
    ) {
        const isAdmin = userRoles.some(r => r.role === UserRole.ADMIN);
        return this.toursService.removePOIFromItinerary(itineraryId, poiId, providerId, isAdmin);
    }

    @Post(':id/suggested-treks')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN, UserRole.VENDOR)
    addSuggestedTrek(
        @Param('id') tourId: string,
        @Body() dto: AddSuggestedTrekDto,
        @getUser('providerId') providerId: string | undefined,
        @getUser('roles') userRoles: { role: UserRole }[],
    ) {
        const isAdmin = userRoles.some(r => r.role === UserRole.ADMIN);
        return this.toursService.addSuggestedTrek(tourId, dto.trekId, dto, providerId, isAdmin);
    }

    @Patch(':id/suggested-treks/:suggestedTrekId')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN, UserRole.VENDOR)
    updateSuggestedTrek(
        @Param('suggestedTrekId') suggestedTrekId: string,
        @Body() dto: UpdateSuggestedTrekDto,
        @getUser('providerId') providerId: string | undefined,
        @getUser('roles') userRoles: { role: UserRole }[],
    ) {
        const isAdmin = userRoles.some(r => r.role === UserRole.ADMIN);
        return this.toursService.updateSuggestedTrek(suggestedTrekId, dto, providerId, isAdmin);
    }

    @Delete(':id/suggested-treks/:suggestedTrekId')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN, UserRole.VENDOR)
    removeSuggestedTrek(
        @Param('suggestedTrekId') suggestedTrekId: string,
        @getUser('providerId') providerId: string | undefined,
        @getUser('roles') userRoles: { role: UserRole }[],
    ) {
        const isAdmin = userRoles.some(r => r.role === UserRole.ADMIN);
        return this.toursService.removeSuggestedTrek(suggestedTrekId, providerId, isAdmin);
    }
}