import { Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "src/services/database/database.service";
import { CreateHomestayDto } from "./dto/create-homestay.dto";

@Injectable()
export class HomestayService {
    constructor(
        private readonly databaseService: DatabaseService
    ) { }

    async createHomestay(userId: string, dto: CreateHomestayDto) {
        const provider = await this.databaseService.provider.findUnique({
            where: { userId },
        });
        if (!provider) {
            throw new NotFoundException('Provider not found');
        }

        const homestay = await this.databaseService.homestay.create({
            data: {
                name: dto.name,
                description: dto.description,
                tags: dto.tags,
                facilities: dto.facilities,
                imageUrls: dto.imageUrls,
                email: dto.email,
                phoneNumber: dto.phoneNumber,
                providerId: provider.id,
            },
        });

        console.log(homestay);

        return homestay;
    }

    async getProviderHomestays(providerId: string) {
        return this.databaseService.homestay.findMany({
            where: { providerId },
            include: {
                rooms: true,
                address: true,
            },
        });
    }

    async getHomestays(filters?: { isActive?: boolean; providerId?: string }) {
        return this.databaseService.homestay.findMany({
            where: {
                ...(filters?.isActive !== undefined && { isActive: filters.isActive }),
                ...(filters?.providerId && { providerId: filters.providerId }),
            },
            include: {
                provider: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                address: true,
                rooms: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getHomestay(id: string) {
        const homestay = await this.databaseService.homestay.findUnique({
            where: { id },
            include: {
                provider: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                address: true,
                rooms: {
                    include: {
                        availability: true,
                    },
                },
            },
        });

        if (!homestay) {
            throw new NotFoundException('Homestay not found');
        }

        return homestay;
    }

    async updateHomestay(id: string, providerId: string, dto: Partial<CreateHomestayDto>) {
        const homestay = await this.databaseService.homestay.findUnique({
            where: { id },
        });

        if (!homestay) {
            throw new NotFoundException('Homestay not found');
        }

        if (homestay.providerId !== providerId) {
            throw new NotFoundException('Unauthorized to update this homestay');
        }

        return this.databaseService.homestay.update({
            where: { id },
            data: dto,
        });
    }

    async getNearbyHomestays(latitude: number, longitude: number, radiusKm: number = 20) {
        const radiusMeters = radiusKm * 1000;

        const nearbyHomestays = await this.databaseService.$queryRaw<Array<{
            id: string;
            name: string;
            description: string;
            imageUrls: string[];
            amenities: string[];
            isActive: boolean;
            providerId: string;
            addressId: string | null;
            distance: number;
        }>>`
            SELECT 
                h.*,
                ST_Distance(
                    a.location,
                    ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
                ) as distance
            FROM "Homestay" h
            LEFT JOIN "Address" a ON h."addressId" = a.id
            WHERE h."isActive" = true
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

        // Fetch full homestay data with relations
        const homestayIds = nearbyHomestays.map(h => h.id);
        const homestays = await this.databaseService.homestay.findMany({
            where: { id: { in: homestayIds } },
            include: {
                provider: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                address: true,
                rooms: true,
            },
        });

        // Map distances to homestays
        return homestays.map(homestay => {
            const homestayData = nearbyHomestays.find(h => h.id === homestay.id);
            return {
                ...homestay,
                distance: homestayData ? Number(homestayData.distance) / 1000 : null, // Convert meters to km
            };
        });
    }
}