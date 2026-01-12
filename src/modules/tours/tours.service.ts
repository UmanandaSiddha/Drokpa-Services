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

    async getNearbyTours(latitude: number, longitude: number, radiusKm: number = 50) {
        const radiusMeters = radiusKm * 1000;

        const nearbyTours = await this.databaseService.$queryRaw<Array<{
            id: string;
            title: string;
            description: string;
            price: number;
            duration: number;
            imageUrls: string[];
            tags: string[];
            maxCapacity: number;
            isActive: boolean;
            addressId: string | null;
            distance: number;
        }>>`
            SELECT 
                t.*,
                ST_Distance(
                    a.location,
                    ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
                ) as distance
            FROM "Tour" t
            LEFT JOIN "Address" a ON t."addressId" = a.id
            WHERE t."isActive" = true
                AND a.location IS NOT NULL
                AND ST_DWithin(
                    a.location,
                    ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
                    ${radiusMeters}
                )
            ORDER BY ST_Distance(
                a.location,
                ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
            )
        `;

        // Fetch full tour data with relations
        const tourIds = nearbyTours.map(t => t.id);
        const tours = await this.databaseService.tour.findMany({
            where: { id: { in: tourIds } },
            include: {
                itinerary: {
                    include: {
                        pois: {
                            include: { poi: true },
                        },
                    },
                },
                address: true,
            },
        });

        // Map distances to tours
        return tours.map(tour => {
            const tourData = nearbyTours.find(t => t.id === tour.id);
            return {
                ...tour,
                distance: tourData ? Number(tourData.distance) / 1000 : null, // Convert meters to km
            };
        });
    }
}