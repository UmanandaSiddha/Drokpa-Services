import { Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "src/services/database/database.service";
import { CreateTourDto } from "./dto/create-tour.dto";
import { AddItineraryDto } from "./dto/add-itinerary.dto";

@Injectable()
export class ToursService {
    constructor(private readonly databaseService: DatabaseService) { }

    async create(dto: CreateTourDto) {
        // Tours are platform-hosted, no provider relation
        return this.databaseService.tour.create({
            data: {
                ...dto,
                maxCapacity: dto.maxCapacity || 10,
            },
        });
    }

    async findAll() {
        return this.databaseService.tour.findMany({
            where: { isActive: true },
            include: {
                itinerary: {
                    include: {
                        pois: {
                            include: {
                                poi: true,
                            },
                        },
                    },
                },
                address: true,
            },
        });
    }

    async findOne(id: string) {
        const tour = await this.databaseService.tour.findUnique({
            where: { id },
            include: {
                itinerary: {
                    include: {
                        pois: {
                            include: {
                                poi: true,
                            },
                            orderBy: { order: 'asc' },
                        },
                    },
                    orderBy: { dayNumber: 'asc' },
                },
                address: true,
            },
        });

        if (!tour) {
            throw new NotFoundException('Tour not found');
        }

        return tour;
    }

    async update(id: string, dto: Partial<CreateTourDto>) {
        const tour = await this.databaseService.tour.findUnique({
            where: { id },
        });

        if (!tour) {
            throw new NotFoundException('Tour not found');
        }

        return this.databaseService.tour.update({
            where: { id },
            data: dto,
        });
    }

    async remove(id: string) {
        const tour = await this.databaseService.tour.findUnique({
            where: { id },
        });

        if (!tour) {
            throw new NotFoundException('Tour not found');
        }

        return this.databaseService.tour.update({
            where: { id },
            data: { isActive: false },
        });
    }

    async addItinerary(tourId: string, dto: AddItineraryDto) {
        const tour = await this.databaseService.tour.findUnique({
            where: { id: tourId },
        });

        if (!tour) {
            throw new NotFoundException('Tour not found');
        }

        return this.databaseService.tourItinerary.create({
            data: {
                tourId,
                ...dto,
            },
        });
    }

    async linkPOIToItinerary(itineraryId: string, poiId: string, order: number) {
        const itinerary = await this.databaseService.tourItinerary.findUnique({
            where: { id: itineraryId },
        });

        if (!itinerary) {
            throw new NotFoundException('Itinerary not found');
        }

        const poi = await this.databaseService.pOI.findUnique({
            where: { id: poiId },
        });

        if (!poi) {
            throw new NotFoundException('POI not found');
        }

        return this.databaseService.tourItineraryPOI.create({
            data: {
                itineraryId,
                poiId,
                order,
            },
        });
    }
}