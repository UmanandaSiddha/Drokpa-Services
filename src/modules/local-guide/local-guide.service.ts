import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from 'src/services/database/database.service';
import { CreateLocalGuideDto } from './dto/create-local-guide.dto';
import { BookingStatus, ProviderType } from 'generated/prisma/enums';
import { Prisma } from 'generated/prisma/client';
import { PrismaApiFeatures, QueryString } from 'src/utils/apiFeatures';

const GUIDE_INCLUDE = {
    provider: { select: { id: true, name: true } },
    address: true,
} satisfies Prisma.LocalGuideInclude;

@Injectable()
export class LocalGuideService {
    constructor(private readonly databaseService: DatabaseService) { }

    // ─────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────

    private async resolveProvider(userId: string) {
        const provider = await this.databaseService.provider.findUnique({
            where: { userId },
            select: { id: true },
        });
        if (!provider) throw new NotFoundException('Provider profile not found');
        return provider;
    }

    private async validateAddress(addressId: string): Promise<void> {
        const address = await this.databaseService.address.findUnique({
            where: { id: addressId },
            select: { id: true },
        });
        if (!address) throw new BadRequestException(`Address ${addressId} not found`);
    }

    // ─────────────────────────────────────────
    // Create
    // ─────────────────────────────────────────

    async createGuide(userId: string, dto: CreateLocalGuideDto) {
        const provider = await this.resolveProvider(userId);

        if (dto.addressId) {
            await this.validateAddress(dto.addressId);
        }

        return this.databaseService.localGuide.create({
            data: {
                bio: dto.bio,
                languages: dto.languages ?? [],
                specialties: dto.specialties ?? [],
                basePricePerDay: dto.basePricePerDay,
                imageUrls: dto.imageUrls ?? [],
                isActive: dto.isActive ?? true,
                providerId: provider.id,
                ...(dto.addressId && { addressId: dto.addressId }),
            },
            include: GUIDE_INCLUDE,
        });
    }

    // ─────────────────────────────────────────
    // List (paginated, filterable, sortable)
    // ─────────────────────────────────────────

    async getGuides(queryStr: QueryString) {
        const features = new PrismaApiFeatures(
            this.databaseService.localGuide,
            queryStr,
        )
            .where({ isActive: true })
            .search(['bio'])
            .filter()
            .sort({ rating: 'desc' } as Prisma.LocalGuideOrderByWithRelationInput)
            .include(GUIDE_INCLUDE)
            .pagination(20);

        const { results, totalCount } = await features.execute();
        const page = Number(queryStr.page) || 1;
        const limit = Number(queryStr.limit) || 20;

        return {
            data: results,
            meta: {
                total: totalCount,
                page,
                limit,
                totalPages: Math.ceil(totalCount / limit),
            },
        };
    }

    // ─────────────────────────────────────────
    // Get by ID
    // ─────────────────────────────────────────

    async getGuide(id: string) {
        const guide = await this.databaseService.localGuide.findUnique({
            where: { id },
            include: GUIDE_INCLUDE,
        });
        if (!guide) throw new NotFoundException('Guide not found');
        return guide;
    }

    // ─────────────────────────────────────────
    // Get My Guides (provider)
    // ─────────────────────────────────────────

    async getMyGuides(userId: string) {
        const provider = await this.resolveProvider(userId);

        return this.databaseService.localGuide.findMany({
            where: { providerId: provider.id },
            include: GUIDE_INCLUDE,
            orderBy: { createdAt: 'desc' },
        });
    }

    // ─────────────────────────────────────────
    // Update
    // ─────────────────────────────────────────

    async updateGuide(id: string, userId: string, dto: Partial<CreateLocalGuideDto>) {
        const provider = await this.resolveProvider(userId);

        const guide = await this.databaseService.localGuide.findUnique({
            where: { id },
            select: { id: true, providerId: true },
        });
        if (!guide) throw new NotFoundException('Guide not found');
        if (guide.providerId !== provider.id) {
            throw new ForbiddenException('You do not have permission to update this guide');
        }

        if (dto.addressId) {
            await this.validateAddress(dto.addressId);
        }

        // Explicit mapping — never spread dto directly into Prisma
        // to avoid accidentally writing non-updatable fields (rating, totalReviews, etc.)
        const data: Prisma.LocalGuideUpdateInput = {
            ...(dto.bio !== undefined && { bio: dto.bio }),
            ...(dto.languages !== undefined && { languages: dto.languages }),
            ...(dto.specialties !== undefined && { specialties: dto.specialties }),
            ...(dto.basePricePerDay !== undefined && { basePricePerDay: dto.basePricePerDay }),
            ...(dto.imageUrls !== undefined && { imageUrls: dto.imageUrls }),
            ...(dto.isActive !== undefined && { isActive: dto.isActive }),
            ...(dto.addressId !== undefined && { addressId: dto.addressId || null }),
        };

        return this.databaseService.localGuide.update({
            where: { id },
            data,
            include: GUIDE_INCLUDE,
        });
    }

    // ─────────────────────────────────────────
    // Delete (soft preferred — checks active bookings)
    // ─────────────────────────────────────────

    async deleteGuide(id: string, userId: string) {
        const provider = await this.resolveProvider(userId);

        const guide = await this.databaseService.localGuide.findUnique({
            where: { id },
            select: { id: true, providerId: true },
        });
        if (!guide) throw new NotFoundException('Guide not found');
        if (guide.providerId !== provider.id) {
            throw new ForbiddenException('You do not have permission to delete this guide');
        }

        // Block hard delete if active bookings exist
        const activeBookings = await this.databaseService.bookingItem.count({
            where: {
                productId: id,
                productType: ProviderType.LOCAL_GUIDE,
                booking: {
                    status: {
                        in: [
                            BookingStatus.REQUESTED,
                            BookingStatus.AWAITING_PAYMENT,
                            BookingStatus.CONFIRMED,
                        ],
                    },
                },
            },
        });

        if (activeBookings > 0) {
            throw new BadRequestException(
                `Cannot delete a guide with ${activeBookings} active booking(s). Deactivate instead.`,
            );
        }

        await this.databaseService.localGuide.delete({ where: { id } });
        return { message: 'Guide deleted successfully' };
    }

    // ─────────────────────────────────────────
    // Nearby (PostGIS)
    // ─────────────────────────────────────────

    async getNearbyGuides(
        latitude: number,
        longitude: number,
        radiusKm: number = 30,
    ) {
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

        const nearby = await this.databaseService.$queryRaw<Array<{ id: string; distance_meters: number }>>`
            SELECT lg.id,
                ST_Distance(
                    a.location,
                    ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
                ) AS distance_meters
            FROM "LocalGuide" lg
            JOIN "Address" a ON lg."addressId" = a.id
            WHERE lg."isActive" = true
            AND a.location IS NOT NULL
            AND ST_DWithin(
                a.location,
                ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
                ${radiusMeters}
            )
            ORDER BY distance_meters ASC
        `;

        if (!nearby.length) return [];

        const distanceMap = new Map(
            nearby.map(r => [r.id, Number(r.distance_meters) / 1000]),
        );

        const guides = await this.databaseService.localGuide.findMany({
            where: { id: { in: [...distanceMap.keys()] } },
            include: GUIDE_INCLUDE,
        });

        return guides
            .map(g => ({ ...g, distanceKm: distanceMap.get(g.id) ?? null }))
            .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    }
}