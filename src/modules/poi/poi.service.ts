import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/services/database/database.service';
import { CreatePOIDto } from './dto/create-poi.dto';

@Injectable()
export class POIService {
    constructor(
        private readonly databaseService: DatabaseService,
    ) { }

    async createPOI(dto: CreatePOIDto) {
        return this.databaseService.pOI.create({
            data: dto,
        });
    }

    async getPOIs(filters?: { name?: string }) {
        return this.databaseService.pOI.findMany({
            where: {
                ...(filters?.name && {
                    name: {
                        contains: filters.name,
                        mode: 'insensitive',
                    },
                }),
            },
            include: {
                address: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getPOI(id: string) {
        const poi = await this.databaseService.pOI.findUnique({
            where: { id },
            include: {
                address: true,
                tourItineraryItems: {
                    include: {
                        itinerary: {
                            include: {
                                tour: true,
                            },
                        },
                    },
                },
            },
        });

        if (!poi) {
            throw new NotFoundException('POI not found');
        }

        return poi;
    }

    async getNearbyPOIs(latitude: number, longitude: number, radiusKm: number = 10) {
        const radiusMeters = radiusKm * 1000;

        // Use PostGIS for accurate distance queries
        const nearbyPOIs = await this.databaseService.$queryRaw<Array<{
            id: string;
            name: string;
            description: string | null;
            specialty: string[];
            imageUrls: string[];
            latitude: number;
            longitude: number;
            addressId: string | null;
            created_at: Date;
            updated_at: Date;
            distance: number;
        }>>`
            SELECT 
                p.*,
                ST_Distance(
                    ST_SetSRID(ST_MakePoint(p.longitude, p.latitude), 4326)::geography,
                    ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
                ) as distance
            FROM "POI" p
            WHERE ST_DWithin(
                ST_SetSRID(ST_MakePoint(p.longitude, p.latitude), 4326)::geography,
                ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
                ${radiusMeters}
            )
            ORDER BY ST_Distance(
                ST_SetSRID(ST_MakePoint(p.longitude, p.latitude), 4326)::geography,
                ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
            )
        `;

        // Fetch address for each POI
        const poisWithAddresses = await Promise.all(
            nearbyPOIs.map(async (poi) => {
                const address = poi.addressId
                    ? await this.databaseService.address.findUnique({
                          where: { id: poi.addressId },
                      })
                    : null;
                return {
                    ...poi,
                    address,
                    distance: Number(poi.distance) / 1000, // Convert meters to km
                };
            })
        );

        return poisWithAddresses;
    }

    async updatePOI(id: string, dto: Partial<CreatePOIDto>) {
        const poi = await this.databaseService.pOI.findUnique({
            where: { id },
        });

        if (!poi) {
            throw new NotFoundException('POI not found');
        }

        return this.databaseService.pOI.update({
            where: { id },
            data: dto,
        });
    }

    async deletePOI(id: string) {
        const poi = await this.databaseService.pOI.findUnique({
            where: { id },
        });

        if (!poi) {
            throw new NotFoundException('POI not found');
        }

        await this.databaseService.pOI.delete({
            where: { id },
        });

        return { message: 'POI deleted successfully' };
    }

    async linkToItinerary(poiId: string, itineraryId: string, order: number) {
        const poi = await this.databaseService.pOI.findUnique({
            where: { id: poiId },
        });

        if (!poi) {
            throw new NotFoundException('POI not found');
        }

        const itinerary = await this.databaseService.tourItinerary.findUnique({
            where: { id: itineraryId },
        });

        if (!itinerary) {
            throw new NotFoundException('Itinerary not found');
        }

        return this.databaseService.tourItineraryPOI.create({
            data: {
                poiId,
                itineraryId,
                order,
            },
        });
    }

}
