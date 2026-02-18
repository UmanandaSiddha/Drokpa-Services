import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { DatabaseService } from "src/services/database/database.service";
import { CreateHomestayDto } from "./dto/create-homestay.dto";
import { BookingCriteria } from "generated/prisma/enums";

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

        // Verify addressId exists if provided
        if (dto.addressId) {
            const address = await this.databaseService.address.findUnique({
                where: { id: dto.addressId },
            });
            if (!address) {
                throw new BadRequestException('Address not found');
            }
        }

        const homestay = await this.databaseService.homestay.create({
            data: {
                name: dto.name,
                description: dto.description,
                houseRules: dto.houseRules || [],
                safetyNSecurity: dto.safetyNSecurity || [],
                imageUrls: dto.imageUrls,
                email: dto.email,
                phoneNumber: dto.phoneNumber,
                displayPrice: dto.displayPrice,
                bookingCriteria: dto.bookingCriteria || BookingCriteria.PER_NIGHT,
                isActive: dto.isActive ?? true,
                providerId: provider.id,
                ...(dto.addressId && { addressId: dto.addressId }),
            },
            include: {
                address: true,
                provider: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                tags: true,
                facilities: true,
            },
        });

        return homestay;
    }

    async getProviderHomestays(providerId: string) {
        // Verify provider exists
        const provider = await this.databaseService.provider.findUnique({
            where: { id: providerId },
        });

        if (!provider) {
            throw new NotFoundException('Provider not found');
        }

        return this.databaseService.homestay.findMany({
            where: { providerId },
            include: {
                rooms: {
                    where: { isActive: true },
                },
                address: true,
                tags: {
                    include: { tag: true },
                },
                facilities: {
                    include: { facility: true },
                },
                reviews: {
                    take: 5,
                    orderBy: { createdAt: 'desc' },
                },
            },
            orderBy: { createdAt: 'desc' },
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
                rooms: {
                    where: { isActive: true },
                    select: { id: true, name: true, basePrice: true, discount: true, finalPrice: true },
                },
                tags: {
                    include: { tag: true },
                },
                facilities: {
                    include: { facility: true },
                },
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
                    where: { isActive: true },
                    include: {
                        availability: true,
                    },
                    orderBy: { basePrice: 'asc' },
                },
                tags: {
                    include: { tag: true },
                },
                facilities: {
                    include: { facility: true },
                },
                reviews: {
                    take: 10,
                    orderBy: { createdAt: 'desc' },
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
            throw new BadRequestException('Unauthorized to update this homestay');
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

        return this.databaseService.homestay.update({
            where: { id },
            data: {
                ...(dto.name && { name: dto.name }),
                ...(dto.description && { description: dto.description }),
                ...(dto.houseRules && { houseRules: dto.houseRules }),
                ...(dto.safetyNSecurity && { safetyNSecurity: dto.safetyNSecurity }),
                ...(dto.imageUrls && { imageUrls: dto.imageUrls }),
                ...(dto.displayPrice !== undefined && { displayPrice: dto.displayPrice }),
                ...(dto.bookingCriteria && { bookingCriteria: dto.bookingCriteria }),
                ...(dto.email && { email: dto.email }),
                ...(dto.phoneNumber && { phoneNumber: dto.phoneNumber }),
                ...(dto.isActive !== undefined && { isActive: dto.isActive }),
                ...(dto.addressId !== undefined && { addressId: dto.addressId || null }),
            },
            include: {
                address: true,
                provider: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                tags: {
                    include: { tag: true },
                },
                facilities: {
                    include: { facility: true },
                },
            },
        });
    }

    async getNearbyHomestays(latitude: number, longitude: number, radiusKm: number = 20) {
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

        // Get homestay IDs ordered by distance
        const nearbyHomestays = await this.databaseService.$queryRaw<Array<{
            id: string;
            distance: number;
        }>>`
            SELECT 
                h.id,
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

        // Return early if no homestays found
        if (!nearbyHomestays || nearbyHomestays.length === 0) {
            return [];
        }

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
                rooms: {
                    where: { isActive: true },
                    orderBy: { basePrice: 'asc' },
                },
                tags: {
                    include: { tag: true },
                },
                facilities: {
                    include: { facility: true },
                },
            },
        });

        // Map distances to homestays, maintaining distance order
        const distanceMap = new Map(nearbyHomestays.map(h => [h.id, Number(h.distance) / 1000]));

        return homestays.map(homestay => ({
            ...homestay,
            distance: distanceMap.get(homestay.id) || null,
        })).sort((a, b) => (a.distance || 0) - (b.distance || 0));
    }

    async addTagsToHomestay(homestayId: string, tagIds: string[], providerId?: string) {
        if (!tagIds || tagIds.length === 0) {
            throw new BadRequestException('At least one tag ID is required');
        }

        // Verify homestay exists and user owns it
        const homestay = await this.databaseService.homestay.findUnique({
            where: { id: homestayId },
        });

        if (!homestay) {
            throw new NotFoundException('Homestay not found');
        }

        if (providerId && homestay.providerId !== providerId) {
            throw new BadRequestException('Unauthorized to modify this homestay');
        }

        // Verify all tag IDs exist
        const existingTags = await this.databaseService.tag.findMany({
            where: { id: { in: tagIds } },
            select: { id: true },
        });

        if (existingTags.length !== tagIds.length) {
            throw new BadRequestException('One or more tag IDs do not exist');
        }

        // Remove duplicate tags and create junction records
        const uniqueTagIds = [...new Set(tagIds)];

        return this.databaseService.$transaction(async tx => {
            // Delete existing tags for this homestay
            await tx.homestayTag.deleteMany({
                where: { homestayId },
            });

            // Create new tag associations
            await tx.homestayTag.createMany({
                data: uniqueTagIds.map(tagId => ({
                    homestayId,
                    tagId,
                })),
            });

            // Return updated homestay with tags
            return tx.homestay.findUnique({
                where: { id: homestayId },
                include: {
                    tags: {
                        include: { tag: true },
                    },
                },
            });
        });
    }

    async addFacilitiesToHomestay(homestayId: string, facilityIds: string[], providerId?: string) {
        if (!facilityIds || facilityIds.length === 0) {
            throw new BadRequestException('At least one facility ID is required');
        }

        // Verify homestay exists and user owns it
        const homestay = await this.databaseService.homestay.findUnique({
            where: { id: homestayId },
        });

        if (!homestay) {
            throw new NotFoundException('Homestay not found');
        }

        if (providerId && homestay.providerId !== providerId) {
            throw new BadRequestException('Unauthorized to modify this homestay');
        }

        // Verify all facility IDs exist
        const existingFacilities = await this.databaseService.facility.findMany({
            where: { id: { in: facilityIds } },
            select: { id: true },
        });

        if (existingFacilities.length !== facilityIds.length) {
            throw new BadRequestException('One or more facility IDs do not exist');
        }

        // Remove duplicate facilities and create junction records
        const uniqueFacilityIds = [...new Set(facilityIds)];

        return this.databaseService.$transaction(async tx => {
            // Delete existing facilities for this homestay
            await tx.homestayFacility.deleteMany({
                where: { homestayId },
            });

            // Create new facility associations
            await tx.homestayFacility.createMany({
                data: uniqueFacilityIds.map(facilityId => ({
                    homestayId,
                    facilityId,
                })),
            });

            // Return updated homestay with facilities
            return tx.homestay.findUnique({
                where: { id: homestayId },
                include: {
                    facilities: {
                        include: { facility: true },
                    },
                },
            });
        });
    }

    async removeTagFromHomestay(homestayId: string, tagId: string, providerId?: string) {
        // Verify homestay exists and user owns it
        const homestay = await this.databaseService.homestay.findUnique({
            where: { id: homestayId },
        });

        if (!homestay) {
            throw new NotFoundException('Homestay not found');
        }

        if (providerId && homestay.providerId !== providerId) {
            throw new BadRequestException('Unauthorized to modify this homestay');
        }

        // Delete the tag association
        await this.databaseService.homestayTag.delete({
            where: {
                homestayId_tagId: {
                    homestayId,
                    tagId,
                },
            },
        }).catch(() => {
            throw new BadRequestException('Tag association not found for this homestay');
        });

        // Return updated homestay
        return this.databaseService.homestay.findUnique({
            where: { id: homestayId },
            include: {
                tags: {
                    include: { tag: true },
                },
            },
        });
    }

    async removeFacilityFromHomestay(homestayId: string, facilityId: string, providerId?: string) {
        // Verify homestay exists and user owns it
        const homestay = await this.databaseService.homestay.findUnique({
            where: { id: homestayId },
        });

        if (!homestay) {
            throw new NotFoundException('Homestay not found');
        }

        if (providerId && homestay.providerId !== providerId) {
            throw new BadRequestException('Unauthorized to modify this homestay');
        }

        // Delete the facility association
        await this.databaseService.homestayFacility.delete({
            where: {
                homestayId_facilityId: {
                    homestayId,
                    facilityId,
                },
            },
        }).catch(() => {
            throw new BadRequestException('Facility association not found for this homestay');
        });

        // Return updated homestay
        return this.databaseService.homestay.findUnique({
            where: { id: homestayId },
            include: {
                facilities: {
                    include: { facility: true },
                },
            },
        });
    }
}