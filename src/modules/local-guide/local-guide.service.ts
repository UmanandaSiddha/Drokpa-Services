import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from 'src/services/database/database.service';
import { CreateLocalGuideDto } from './dto/create-local-guide.dto';

@Injectable()
export class LocalGuideService {
    constructor(
        private readonly databaseService: DatabaseService,
    ) { }

    async createGuide(providerId: string, dto: CreateLocalGuideDto) {
        // Verify provider exists
        const provider = await this.databaseService.provider.findUnique({
            where: { id: providerId },
        });

        if (!provider) {
            throw new NotFoundException('Provider not found');
        }

        // Verify addressId if provided
        if (dto.addressId) {
            const address = await this.databaseService.address.findUnique({
                where: { id: dto.addressId },
            });
            if (!address) {
                throw new BadRequestException('Address not found');
            }
        }

        return this.databaseService.localGuide.create({
            data: {
                ...dto,
                providerId,
            },
            include: {
                provider: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                address: true,
            },
        });
    }

    async getGuides(filters?: { isActive?: boolean; providerId?: string; specialties?: string[] }) {
        return this.databaseService.localGuide.findMany({
            where: {
                ...(filters?.isActive !== undefined && { isActive: filters.isActive }),
                ...(filters?.providerId && { providerId: filters.providerId }),
                ...(filters?.specialties && {
                    specialties: {
                        hasSome: filters.specialties,
                    },
                }),
            },
            include: {
                provider: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                address: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getGuide(id: string) {
        const guide = await this.databaseService.localGuide.findUnique({
            where: { id },
            include: {
                provider: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                address: true,
            },
        });

        if (!guide) {
            throw new NotFoundException('Guide not found');
        }

        return guide;
    }

    async updateGuide(id: string, providerId: string, dto: Partial<CreateLocalGuideDto>) {
        const guide = await this.databaseService.localGuide.findUnique({
            where: { id },
        });

        if (!guide) {
            throw new NotFoundException('Guide not found');
        }

        if (guide.providerId !== providerId) {
            throw new BadRequestException('Unauthorized to update this guide');
        }

        // Verify addressId if provided
        if (dto.addressId) {
            const address = await this.databaseService.address.findUnique({
                where: { id: dto.addressId },
            });
            if (!address) {
                throw new BadRequestException('Address not found');
            }
        }

        return this.databaseService.localGuide.update({
            where: { id },
            data: dto,
            include: {
                provider: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                address: true,
            },
        });
    }

    async deleteGuide(id: string, providerId: string) {
        const guide = await this.databaseService.localGuide.findUnique({
            where: { id },
        });

        if (!guide) {
            throw new NotFoundException('Guide not found');
        }

        if (guide.providerId !== providerId) {
            throw new BadRequestException('Unauthorized to delete this guide');
        }

        await this.databaseService.localGuide.delete({
            where: { id },
        });

        return { message: 'Guide deleted successfully' };
    }

    async getMyGuides(providerId: string) {
        // Verify provider exists
        const provider = await this.databaseService.provider.findUnique({
            where: { id: providerId },
        });

        if (!provider) {
            throw new NotFoundException('Provider not found');
        }

        return this.databaseService.localGuide.findMany({
            where: { providerId },
            include: {
                address: true,
                provider: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getNearbyGuides(latitude: number, longitude: number, radiusKm: number = 30) {
        // Validate input parameters
        if (latitude < -90 || latitude > 90) {
            throw new BadRequestException('Latitude must be between -90 and 90');
        }

        if (longitude < -180 || longitude > 180) {
            throw new BadRequestException('Longitude must be between -180 and 180');
        }

        if (radiusKm <= 0) {
            throw new BadRequestException('Radius must be greater than 0');
        }

        const radiusMeters = radiusKm * 1000;

        // Get guide IDs ordered by distance
        const nearbyGuides = await this.databaseService.$queryRaw<Array<{
            id: string;
            distance: number;
        }>>`
            SELECT 
                lg.id,
                ST_Distance(
                    a.location,
                    ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
                ) as distance
            FROM "LocalGuide" lg
            LEFT JOIN "Address" a ON lg."addressId" = a.id
            WHERE lg."isActive" = true
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

        // Return early if no guides found
        if (!nearbyGuides || nearbyGuides.length === 0) {
            return [];
        }

        // Fetch full guide data with relations
        const guideIds = nearbyGuides.map(g => g.id);
        const guides = await this.databaseService.localGuide.findMany({
            where: { id: { in: guideIds } },
            include: {
                provider: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                address: true,
            },
        });

        // Map distances to guides using efficient Map structure
        const distanceMap = new Map(nearbyGuides.map(g => [g.id, Number(g.distance) / 1000]));

        return guides.map(guide => ({
            ...guide,
            distance: distanceMap.get(guide.id) || null,
        })).sort((a, b) => (a.distance || 0) - (b.distance || 0));
    }
}
