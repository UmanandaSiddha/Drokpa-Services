import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DatabaseService } from 'src/services/database/database.service';
import { CreateLocalGuideDto } from './dto/create-local-guide.dto';

@Injectable()
export class LocalGuideService {
    constructor(
        private readonly databaseService: DatabaseService,
    ) { }

    async createGuide(providerId: string, dto: CreateLocalGuideDto) {
        return this.databaseService.localGuide.create({
            data: {
                ...dto,
                providerId,
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
            throw new ForbiddenException('You do not have permission to update this guide');
        }

        return this.databaseService.localGuide.update({
            where: { id },
            data: dto,
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
            throw new ForbiddenException('You do not have permission to delete this guide');
        }

        await this.databaseService.localGuide.delete({
            where: { id },
        });

        return { message: 'Guide deleted successfully' };
    }

    async getMyGuides(providerId: string) {
        return this.databaseService.localGuide.findMany({
            where: { providerId },
            include: {
                address: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getNearbyGuides(latitude: number, longitude: number, radiusKm: number = 30) {
        const radiusMeters = radiusKm * 1000;

        const nearbyGuides = await this.databaseService.$queryRaw<Array<{
            id: string;
            providerId: string;
            bio: string | null;
            languages: string[];
            specialties: string[];
            basePricePerDay: number;
            imageUrls: string[];
            rating: number | null;
            totalReviews: number;
            isActive: boolean;
            addressId: string | null;
            distance: number;
        }>>`
            SELECT 
                lg.*,
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

        // Map distances to guides
        return guides.map(guide => {
            const guideData = nearbyGuides.find(g => g.id === guide.id);
            return {
                ...guide,
                distance: guideData ? Number(guideData.distance) / 1000 : null, // Convert meters to km
            };
        });
    }
}
