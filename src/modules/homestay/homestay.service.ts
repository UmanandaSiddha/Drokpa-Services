import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from 'src/services/database/database.service';
import { CreateHomestayDto } from './dto/create-homestay.dto';
import { BookingCriteria } from 'generated/prisma/enums';
import { Prisma } from 'generated/prisma/client';
import { PrismaApiFeatures, QueryString } from 'src/utils/apiFeatures';

// ─────────────────────────────────────────────
// Reusable include shapes
// ─────────────────────────────────────────────

/** Lightweight: list views — no reviews, no availability */
const HOMESTAY_LIST_INCLUDE = {
    provider: { select: { id: true, name: true } },
    address: true,
    rooms: {
        where: { isActive: true },
        select: {
            id: true,
            name: true,
            capacity: true,
            basePrice: true,
            discount: true,
            finalPrice: true,
            bookingCriteria: true,
            totalRooms: true,
        },
    },
    tags: { include: { tag: true } },
    facilities: { include: { facility: true } },
} satisfies Prisma.HomestayInclude;

/**
 * Full detail: single homestay view.
 * Availability is filtered from today forward — never loads historical rows.
 * Pass checkIn/checkOut to narrow further at the query layer.
 */
const buildDetailInclude = (
    checkIn?: Date,
    checkOut?: Date,
): Prisma.HomestayInclude => ({
    provider: { select: { id: true, name: true } },
    address: true,
    rooms: {
        where: { isActive: true },
        include: {
            availability: {
                where: {
                    date: {
                        gte: checkIn ?? new Date(),
                        ...(checkOut && { lte: checkOut }),
                    },
                },
                orderBy: { date: 'asc' },
            },
        },
        orderBy: { basePrice: 'asc' },
    },
    tags: { include: { tag: true } },
    facilities: { include: { facility: true } },
    reviews: {
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
            user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        },
    },
});

@Injectable()
export class HomestayService {
    constructor(private readonly databaseService: DatabaseService) { }

    // ─────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────

    /** Throws if the address ID doesn't exist in the DB */
    private async validateAddress(addressId: string): Promise<void> {
        const address = await this.databaseService.address.findUnique({
            where: { id: addressId },
            select: { id: true },
        });
        if (!address) {
            throw new BadRequestException(`Address ${addressId} not found`);
        }
    }

    /** Throws ForbiddenException if the homestay doesn't belong to the provider */
    private assertOwnership(homestayProviderId: string, providerId: string): void {
        if (homestayProviderId !== providerId) {
            throw new ForbiddenException('You do not have permission to modify this homestay');
        }
    }

    // ─────────────────────────────────────────
    // Create
    // ─────────────────────────────────────────

    async createHomestay(userId: string, dto: CreateHomestayDto) {
        const provider = await this.databaseService.provider.findUnique({
            where: { userId },
            select: { id: true },
        });
        if (!provider) {
            throw new NotFoundException('Provider profile not found for this user');
        }

        if (dto.addressId) {
            await this.validateAddress(dto.addressId);
        }

        return this.databaseService.homestay.create({
            data: {
                name: dto.name,
                description: dto.description,
                houseRules: dto.houseRules ?? [],
                safetyNSecurity: dto.safetyNSecurity ?? [],
                imageUrls: dto.imageUrls ?? [],
                email: dto.email,
                phoneNumber: dto.phoneNumber,
                displayPrice: dto.displayPrice,
                bookingCriteria: dto.bookingCriteria ?? BookingCriteria.PER_NIGHT,
                isActive: dto.isActive ?? true,
                providerId: provider.id,
                ...(dto.addressId && { addressId: dto.addressId }),
            },
            include: HOMESTAY_LIST_INCLUDE,
        });
    }

    // ─────────────────────────────────────────
    // List (paginated, filterable, sortable)
    // ─────────────────────────────────────────

    async getHomestays(queryStr: QueryString) {
        const features = new PrismaApiFeatures(
            this.databaseService.homestay,
            queryStr,
        )
            .where({ isActive: true })
            .search(['name', 'description'])
            .filter()
            .sort({ rating: 'desc' } as Prisma.HomestayOrderByWithRelationInput)
            .include(HOMESTAY_LIST_INCLUDE)
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
    // Provider's own homestays
    // ─────────────────────────────────────────

    async getProviderHomestays(providerId: string) {
        const provider = await this.databaseService.provider.findUnique({
            where: { id: providerId },
            select: { id: true },
        });
        if (!provider) {
            throw new NotFoundException('Provider not found');
        }

        return this.databaseService.homestay.findMany({
            where: { providerId },
            include: {
                // Provider already knows who they are — omit provider relation here
                address: true,
                rooms: {
                    where: { isActive: true },
                    select: {
                        id: true,
                        name: true,
                        capacity: true,
                        basePrice: true,
                        discount: true,
                        finalPrice: true,
                        totalRooms: true,
                        bookingCriteria: true,
                    },
                },
                tags: { include: { tag: true } },
                facilities: { include: { facility: true } },
                // rating + totalReviews on the Homestay row are sufficient for list views
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    // ─────────────────────────────────────────
    // Get by ID (full detail)
    // ─────────────────────────────────────────

    async getHomestay(
        id: string,
        options?: { checkIn?: Date; checkOut?: Date },
    ) {
        const homestay = await this.databaseService.homestay.findUnique({
            where: { id },
            include: buildDetailInclude(options?.checkIn, options?.checkOut),
        });

        if (!homestay) {
            throw new NotFoundException('Homestay not found');
        }

        return homestay;
    }

    // ─────────────────────────────────────────
    // Update
    // ─────────────────────────────────────────

    async updateHomestay(
        id: string,
        providerId: string,
        dto: Partial<CreateHomestayDto>,
    ) {
        const homestay = await this.databaseService.homestay.findUnique({
            where: { id },
            select: { id: true, providerId: true },
        });
        if (!homestay) throw new NotFoundException('Homestay not found');

        this.assertOwnership(homestay.providerId, providerId);

        if (dto.addressId) {
            await this.validateAddress(dto.addressId);
        }

        // Use !== undefined throughout — falsy check silently skips empty arrays & false values
        const data: Prisma.HomestayUpdateInput = {
            ...(dto.name !== undefined && { name: dto.name }),
            ...(dto.description !== undefined && { description: dto.description }),
            ...(dto.houseRules !== undefined && { houseRules: dto.houseRules }),
            ...(dto.safetyNSecurity !== undefined && { safetyNSecurity: dto.safetyNSecurity }),
            ...(dto.imageUrls !== undefined && { imageUrls: dto.imageUrls }),
            ...(dto.displayPrice !== undefined && { displayPrice: dto.displayPrice }),
            ...(dto.bookingCriteria !== undefined && { bookingCriteria: dto.bookingCriteria }),
            ...(dto.email !== undefined && { email: dto.email }),
            ...(dto.phoneNumber !== undefined && { phoneNumber: dto.phoneNumber }),
            ...(dto.isActive !== undefined && { isActive: dto.isActive }),
            ...(dto.addressId !== undefined && { addressId: dto.addressId || null }),
        };

        return this.databaseService.homestay.update({
            where: { id },
            data,
            include: HOMESTAY_LIST_INCLUDE,
        });
    }

    // ─────────────────────────────────────────
    // Nearby (PostGIS)
    // ─────────────────────────────────────────

    async getNearbyHomestays(
        latitude: number,
        longitude: number,
        radiusKm: number = 20,
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

        // IDs + distances only — avoids t.* camelCase/snake_case mismatch
        // JOIN (not LEFT JOIN) because LEFT JOIN + WHERE a.location IS NOT NULL = JOIN anyway
        // Alias distance_meters so ORDER BY references the alias — no double computation
        const nearby = await this.databaseService.$queryRaw<
            Array<{ id: string; distance_meters: number }>
        >`
            SELECT h.id,
                   ST_Distance(
                       a.location,
                       ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
                   ) AS distance_meters
            FROM "Homestay" h
            JOIN "Address" a ON h."addressId" = a.id
            WHERE h."isActive" = true
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

        const homestays = await this.databaseService.homestay.findMany({
            where: { id: { in: [...distanceMap.keys()] } },
            include: HOMESTAY_LIST_INCLUDE,
        });

        return homestays
            .map(h => ({ ...h, distanceKm: distanceMap.get(h.id) ?? null }))
            // Null distance goes to the end, not the top
            .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    }

    // ─────────────────────────────────────────
    // Tags
    // ─────────────────────────────────────────

    async addTagsToHomestay(
        homestayId: string,
        tagIds: string[],
        providerId?: string,
    ) {
        if (!tagIds.length) {
            throw new BadRequestException('At least one tag ID is required');
        }

        const homestay = await this.databaseService.homestay.findUnique({
            where: { id: homestayId },
            select: { id: true, providerId: true },
        });
        if (!homestay) throw new NotFoundException('Homestay not found');
        if (providerId) this.assertOwnership(homestay.providerId, providerId);

        // Validate all tag IDs exist in one query
        const existingTags = await this.databaseService.tag.findMany({
            where: { id: { in: tagIds } },
            select: { id: true },
        });
        if (existingTags.length !== tagIds.length) {
            const foundIds = new Set(existingTags.map(t => t.id));
            const missing = tagIds.filter(id => !foundIds.has(id));
            throw new BadRequestException(`Tags not found: ${missing.join(', ')}`);
        }

        const uniqueTagIds = [...new Set(tagIds)];

        return this.databaseService.$transaction(async tx => {
            await tx.homestayTag.deleteMany({ where: { homestayId } });
            await tx.homestayTag.createMany({
                data: uniqueTagIds.map(tagId => ({ homestayId, tagId })),
            });
            return tx.homestay.findUnique({
                where: { id: homestayId },
                include: { tags: { include: { tag: true } } },
            });
        });
    }

    async removeTagFromHomestay(
        homestayId: string,
        tagId: string,
        providerId?: string,
    ) {
        const homestay = await this.databaseService.homestay.findUnique({
            where: { id: homestayId },
            select: { id: true, providerId: true },
        });
        if (!homestay) throw new NotFoundException('Homestay not found');
        if (providerId) this.assertOwnership(homestay.providerId, providerId);

        try {
            await this.databaseService.homestayTag.delete({
                where: { homestayId_tagId: { homestayId, tagId } },
            });
        } catch {
            throw new BadRequestException('Tag is not associated with this homestay');
        }

        return this.databaseService.homestay.findUnique({
            where: { id: homestayId },
            include: { tags: { include: { tag: true } } },
        });
    }

    // ─────────────────────────────────────────
    // Facilities
    // ─────────────────────────────────────────

    async addFacilitiesToHomestay(
        homestayId: string,
        facilityIds: string[],
        providerId?: string,
    ) {
        if (!facilityIds.length) {
            throw new BadRequestException('At least one facility ID is required');
        }

        const homestay = await this.databaseService.homestay.findUnique({
            where: { id: homestayId },
            select: { id: true, providerId: true },
        });
        if (!homestay) throw new NotFoundException('Homestay not found');
        if (providerId) this.assertOwnership(homestay.providerId, providerId);

        const existingFacilities = await this.databaseService.facility.findMany({
            where: { id: { in: facilityIds } },
            select: { id: true },
        });
        if (existingFacilities.length !== facilityIds.length) {
            const foundIds = new Set(existingFacilities.map(f => f.id));
            const missing = facilityIds.filter(id => !foundIds.has(id));
            throw new BadRequestException(`Facilities not found: ${missing.join(', ')}`);
        }

        const uniqueFacilityIds = [...new Set(facilityIds)];

        return this.databaseService.$transaction(async tx => {
            await tx.homestayFacility.deleteMany({ where: { homestayId } });
            await tx.homestayFacility.createMany({
                data: uniqueFacilityIds.map(facilityId => ({ homestayId, facilityId })),
            });
            return tx.homestay.findUnique({
                where: { id: homestayId },
                include: { facilities: { include: { facility: true } } },
            });
        });
    }

    async removeFacilityFromHomestay(
        homestayId: string,
        facilityId: string,
        providerId?: string,
    ) {
        const homestay = await this.databaseService.homestay.findUnique({
            where: { id: homestayId },
            select: { id: true, providerId: true },
        });
        if (!homestay) throw new NotFoundException('Homestay not found');
        if (providerId) this.assertOwnership(homestay.providerId, providerId);

        try {
            await this.databaseService.homestayFacility.delete({
                where: { homestayId_facilityId: { homestayId, facilityId } },
            });
        } catch {
            throw new BadRequestException('Facility is not associated with this homestay');
        }

        return this.databaseService.homestay.findUnique({
            where: { id: homestayId },
            include: { facilities: { include: { facility: true } } },
        });
    }
}