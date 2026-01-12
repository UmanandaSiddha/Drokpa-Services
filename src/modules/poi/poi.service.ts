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
        // For now, simple distance calculation
        // In production, use PostGIS for accurate distance queries
        const allPOIs = await this.databaseService.pOI.findMany({
            include: {
                address: true,
            },
        });

        // Calculate distance using Haversine formula
        const nearbyPOIs = allPOIs.filter(poi => {
            const distance = this.calculateDistance(
                latitude,
                longitude,
                poi.latitude,
                poi.longitude,
            );
            return distance <= radiusKm;
        });

        return nearbyPOIs;
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

    private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371; // Radius of the Earth in km
        const dLat = this.deg2rad(lat2 - lat1);
        const dLon = this.deg2rad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // Distance in km
    }

    private deg2rad(deg: number): number {
        return deg * (Math.PI / 180);
    }
}
