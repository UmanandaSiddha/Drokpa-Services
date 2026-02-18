import { Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "src/services/database/database.service";
import { CreateTourDto } from "./dto/create-tour.dto";
import { AddItineraryDto } from "./dto/add-itinerary.dto";

@Injectable()
export class ToursService {
    constructor(private readonly databaseService: DatabaseService) { }

    private computeFinalPrice(basePrice: number, discount: number = 0) {
        const normalizedDiscount = Math.max(0, Math.min(100, discount));
        return Math.round(basePrice - (basePrice * normalizedDiscount) / 100);
    }

    async createTour(dto: CreateTourDto) {
        const basePrice = dto.price;
        const discount = 0;
        const finalPrice = this.computeFinalPrice(basePrice, discount);

        // Tours are platform-hosted, no provider relation
        return this.databaseService.tour.create({
            data: {
                title: dto.title,
                description: dto.description,
                basePrice,
                discount,
                finalPrice,
                duration: dto.duration,
                imageUrls: dto.imageUrls,
                maxCapacity: dto.maxCapacity ?? 10,
                addressId: dto.addressId,
                about: dto.about,
                included: dto.included,
                notIncluded: dto.notIncluded,
                highlights: dto.highlights,
                brochure: dto.brochure,
                isActive: dto.isActive,
                ...(dto.tags?.length
                    ? {
                        tags: {
                            create: dto.tags.map(label => ({
                                tag: { connect: { label } },
                            })),
                        },
                    }
                    : {}),
            },
        });
    }

    async listActiveTours() {
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

    async getTourById(id: string) {
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

    async updateTourById(id: string, dto: Partial<CreateTourDto>) {
        const tour = await this.databaseService.tour.findUnique({
            where: { id },
        });

        if (!tour) {
            throw new NotFoundException('Tour not found');
        }

        const basePrice = dto.price;
        const discount = (dto as { discount?: number }).discount;
        const shouldRecomputeFinal = basePrice !== undefined || discount !== undefined;
        const nextBasePrice = basePrice ?? tour.basePrice;
        const nextDiscount = discount ?? tour.discount;

        const updateData: {
            title?: string;
            description?: string;
            basePrice?: number;
            discount?: number;
            finalPrice?: number;
            duration?: number;
            imageUrls?: string[];
            maxCapacity?: number;
            addressId?: string | null;
            about?: string | null;
            included?: string[];
            notIncluded?: string[];
            highlights?: string[];
            brochure?: string | null;
            isActive?: boolean;
            tags?: {
                deleteMany: Record<string, never>;
                create: Array<{ tag: { connect: { label: string } } }>;
            };
        } = {
            title: dto.title,
            description: dto.description,
            duration: dto.duration,
            imageUrls: dto.imageUrls,
            maxCapacity: dto.maxCapacity,
            addressId: dto.addressId,
            about: dto.about,
            included: dto.included,
            notIncluded: dto.notIncluded,
            highlights: dto.highlights,
            brochure: dto.brochure,
            isActive: dto.isActive,
        };

        if (basePrice !== undefined) {
            updateData.basePrice = basePrice;
        }

        if (discount !== undefined) {
            updateData.discount = discount;
        }

        if (shouldRecomputeFinal) {
            updateData.finalPrice = this.computeFinalPrice(nextBasePrice, nextDiscount);
        }

        if (dto.tags) {
            updateData.tags = {
                deleteMany: {},
                create: dto.tags.map(label => ({
                    tag: { connect: { label } },
                })),
            };
        }

        return this.databaseService.tour.update({
            where: { id },
            data: updateData,
        });
    }

    async deactivateTour(id: string) {
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

    async addTourItineraryDay(tourId: string, dto: AddItineraryDto) {
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

    async addPoiToItinerary(itineraryId: string, poiId: string, order: number) {
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

    async findNearbyTours(latitude: number, longitude: number, radiusKm: number = 50) {
        const radiusMeters = radiusKm * 1000;

        const nearbyTours = await this.databaseService.$queryRaw<Array<{
            id: string;
            title: string;
            description: string;
            basePrice: number;
            discount: number;
            finalPrice: number;
            duration: number;
            imageUrls: string[];
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