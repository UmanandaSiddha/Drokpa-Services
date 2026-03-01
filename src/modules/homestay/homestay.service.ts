import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from 'src/services/database/database.service';
import { CreateHomestayDto } from './dto/create-homestay.dto';
import { BookingCriteria, BookingStatus } from 'generated/prisma/enums';
import { Prisma } from 'generated/prisma/client';
import { PrismaApiFeatures, QueryString } from 'src/utils/apiFeatures';
import { CreateHomestayRoomDto } from './dto/create-room.dto';
import { generateUniqueSlugFromText } from 'src/utils/slug.helper';

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

    private async getProviderIdByUserId(userId: string): Promise<string> {
        const provider = await this.databaseService.provider.findUnique({
            where: { userId },
            select: { id: true },
        });
        if (!provider) {
            throw new NotFoundException('Provider profile not found for this user');
        }
        return provider.id;
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

        // Generate unique slug from name
        const slug = await generateUniqueSlugFromText(
            dto.name,
            async (candidate) => {
                const existing = await this.databaseService.homestay.findUnique({
                    where: { slug: candidate },
                });
                return !!existing;
            },
        );

        return this.databaseService.homestay.create({
            data: {
                name: dto.name,
                slug,
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
    // Get by Slug (SEO-friendly URL)
    // ─────────────────────────────────────────

    async getHomestayBySlug(
        slug: string,
        options?: { checkIn?: Date; checkOut?: Date },
    ) {
        const homestay = await this.databaseService.homestay.findUnique({
            where: { slug },
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
        skipOwnershipCheck = false,
    ) {
        const homestay = await this.databaseService.homestay.findUnique({
            where: { id },
            select: { id: true, providerId: true, name: true, slug: true },
        });
        if (!homestay) throw new NotFoundException('Homestay not found');

        if (!skipOwnershipCheck) this.assertOwnership(homestay.providerId, providerId);

        if (dto.addressId) {
            await this.validateAddress(dto.addressId);
        }

        // Regenerate slug if name changes
        let slug = homestay.slug;
        if (dto.name && dto.name !== homestay.name) {
            slug = await generateUniqueSlugFromText(
                dto.name,
                async (candidate) => {
                    const existing = await this.databaseService.homestay.findUnique({
                        where: { slug: candidate },
                    });
                    // Allow the current homestay's slug to match itself
                    return !!existing && existing.id !== id;
                },
            );
        }

        // Use !== undefined throughout — falsy check silently skips empty arrays & false values
        const data: Prisma.HomestayUpdateInput = {
            ...(dto.name !== undefined && { name: dto.name }),
            ...(dto.name !== undefined && { slug }),
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
        const nearby = await this.databaseService.$queryRaw<Array<{ id: string; distance_meters: number }>>`
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
        skipOwnershipCheck = false,
    ) {
        if (!tagIds.length) {
            throw new BadRequestException('At least one tag ID is required');
        }

        const homestay = await this.databaseService.homestay.findUnique({
            where: { id: homestayId },
            select: { id: true, providerId: true },
        });
        if (!homestay) throw new NotFoundException('Homestay not found');
        if (!skipOwnershipCheck && providerId) this.assertOwnership(homestay.providerId, providerId);

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
        skipOwnershipCheck = false,
    ) {
        const homestay = await this.databaseService.homestay.findUnique({
            where: { id: homestayId },
            select: { id: true, providerId: true },
        });
        if (!homestay) throw new NotFoundException('Homestay not found');
        if (!skipOwnershipCheck && providerId) this.assertOwnership(homestay.providerId, providerId);

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
        skipOwnershipCheck = false,
    ) {
        if (!facilityIds.length) {
            throw new BadRequestException('At least one facility ID is required');
        }

        const homestay = await this.databaseService.homestay.findUnique({
            where: { id: homestayId },
            select: { id: true, providerId: true },
        });
        if (!homestay) throw new NotFoundException('Homestay not found');
        if (!skipOwnershipCheck && providerId) this.assertOwnership(homestay.providerId, providerId);

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
        skipOwnershipCheck = false,
    ) {
        const homestay = await this.databaseService.homestay.findUnique({
            where: { id: homestayId },
            select: { id: true, providerId: true },
        });
        if (!homestay) throw new NotFoundException('Homestay not found');
        if (!skipOwnershipCheck && providerId) this.assertOwnership(homestay.providerId, providerId);

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

    // ─────────────────────────────────────────
    // Rooms
    // ─────────────────────────────────────────

    async createRoom(
        homestayId: string,
        userId: string,
        dto: CreateHomestayRoomDto,
        skipOwnershipCheck = false,
    ) {
        const homestay = await this.databaseService.homestay.findUnique({
            where: { id: homestayId },
            select: { id: true, providerId: true },
        });
        if (!homestay) throw new NotFoundException('Homestay not found');

        if (!skipOwnershipCheck) {
            const providerId = await this.getProviderIdByUserId(userId);
            this.assertOwnership(homestay.providerId, providerId);
        }

        const discount = dto.discount ?? 0;
        const finalPrice = Math.max(0, dto.basePrice - discount);

        return this.databaseService.homestayRoom.create({
            data: {
                homestayId,
                name: dto.name,
                description: dto.description,
                capacity: dto.capacity,
                basePrice: dto.basePrice,
                discount,
                finalPrice,
                bookingCriteria: dto.bookingCriteria ?? BookingCriteria.PER_NIGHT,
                totalRooms: dto.totalRooms,
                amenities: dto.amenities ?? [],
                imageUrls: dto.imageUrls ?? [],
                isActive: dto.isActive ?? true,
            },
            include: {
                homestay: { select: { id: true, name: true } },
            },
        });
    }

    async getRooms(homestayId: string) {
        const homestay = await this.databaseService.homestay.findUnique({
            where: { id: homestayId },
            select: { id: true },
        });
        if (!homestay) throw new NotFoundException('Homestay not found');

        return this.databaseService.homestayRoom.findMany({
            where: { homestayId, isActive: true },
            orderBy: { basePrice: 'asc' },
        });
    }

    async updateRoom(
        homestayId: string,
        roomId: string,
        userId: string,
        dto: Partial<CreateHomestayRoomDto>,
        skipOwnershipCheck = false,
    ) {
        const room = await this.databaseService.homestayRoom.findFirst({
            where: { id: roomId, homestayId },
            include: { homestay: { select: { providerId: true } } },
        });
        if (!room) throw new NotFoundException('Room not found for this homestay');

        if (!skipOwnershipCheck) {
            const providerId = await this.getProviderIdByUserId(userId);
            this.assertOwnership(room.homestay.providerId, providerId);
        }

        const nextBasePrice = dto.basePrice ?? room.basePrice;
        const nextDiscount = dto.discount ?? room.discount;
        const data: Prisma.HomestayRoomUpdateInput = {
            ...(dto.name !== undefined && { name: dto.name }),
            ...(dto.description !== undefined && { description: dto.description }),
            ...(dto.capacity !== undefined && { capacity: dto.capacity }),
            ...(dto.basePrice !== undefined && { basePrice: dto.basePrice }),
            ...(dto.discount !== undefined && { discount: dto.discount }),
            ...(dto.bookingCriteria !== undefined && { bookingCriteria: dto.bookingCriteria }),
            ...(dto.totalRooms !== undefined && { totalRooms: dto.totalRooms }),
            ...(dto.amenities !== undefined && { amenities: dto.amenities }),
            ...(dto.imageUrls !== undefined && { imageUrls: dto.imageUrls }),
            ...(dto.isActive !== undefined && { isActive: dto.isActive }),
            finalPrice: Math.max(0, nextBasePrice - nextDiscount),
        };

        return this.databaseService.homestayRoom.update({
            where: { id: roomId },
            data,
            include: {
                homestay: { select: { id: true, name: true } },
            },
        });
    }

    async deleteRoom(
        homestayId: string,
        roomId: string,
        userId: string,
        skipOwnershipCheck = false,
    ) {
        const room = await this.databaseService.homestayRoom.findFirst({
            where: { id: roomId, homestayId },
            include: { homestay: { select: { providerId: true } } },
        });
        if (!room) throw new NotFoundException('Room not found for this homestay');

        if (!skipOwnershipCheck) {
            const providerId = await this.getProviderIdByUserId(userId);
            this.assertOwnership(room.homestay.providerId, providerId);
        }

        const activeBookings = await this.databaseService.roomBooking.count({
            where: {
                roomId,
                bookingItem: {
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
            },
        });

        if (activeBookings > 0) {
            throw new BadRequestException(
                `Cannot delete room with ${activeBookings} active booking(s). Deactivate instead.`,
            );
        }

        await this.databaseService.homestayRoom.update({
            where: { id: roomId },
            data: { isActive: false },
        });

        return { message: 'Room deleted successfully' };
    }

    // ─────────────────────────────────────────
    // Delete Homestay
    // ─────────────────────────────────────────

    async deleteHomestay(
        id: string,
        userId: string,
        skipOwnershipCheck = false,
    ) {
        const homestay = await this.databaseService.homestay.findUnique({
            where: { id },
            select: { id: true, providerId: true },
        });
        if (!homestay) throw new NotFoundException('Homestay not found');

        if (!skipOwnershipCheck) {
            const providerId = await this.getProviderIdByUserId(userId);
            this.assertOwnership(homestay.providerId, providerId);
        }

        // Check for active bookings across all rooms
        const activeBookings = await this.databaseService.roomBooking.count({
            where: {
                room: { homestayId: id },
                bookingItem: {
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
            },
        });

        if (activeBookings > 0) {
            throw new BadRequestException(
                `Cannot delete homestay with ${activeBookings} active booking(s). Deactivate instead.`,
            );
        }

        // Soft delete by setting isActive to false
        await this.databaseService.homestay.update({
            where: { id },
            data: { isActive: false },
        });

        return { message: 'Homestay deleted successfully' };
    }
}