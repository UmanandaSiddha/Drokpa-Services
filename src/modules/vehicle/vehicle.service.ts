import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from 'src/services/database/database.service';
import { PrismaApiFeatures, QueryString } from 'src/utils/apiFeatures';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { BookingStatus, ProviderType, VehicleType } from 'generated/prisma/enums';
import { Prisma } from 'generated/prisma/client';

// ─────────────────────────────────────────────
// Reusable include shape
// ─────────────────────────────────────────────
const VEHICLE_INCLUDE = {
    provider: { select: { id: true, name: true } },
    address: true,
} satisfies Prisma.VehicleInclude;

@Injectable()
export class VehicleService {
    constructor(private readonly databaseService: DatabaseService) { }

    // ─────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────

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

    async createVehicle(providerId: string, dto: CreateVehicleDto) {
        const existing = await this.databaseService.vehicle.findUnique({
            where: { registrationNo: dto.registrationNo },
            select: { id: true },
        });
        if (existing) {
            throw new BadRequestException(
                'A vehicle with this registration number already exists',
            );
        }

        if (dto.addressId) {
            await this.validateAddress(dto.addressId);
        }

        return this.databaseService.vehicle.create({
            data: {
                name: dto.name,
                type: dto.type,
                brand: dto.brand,
                model: dto.model,
                registrationNo: dto.registrationNo,
                imageUrls: dto.imageUrls ?? [],
                basePricePerDay: dto.basePricePerDay,
                bookingMode: dto.bookingMode ?? [],
                isActive: dto.isActive ?? true,
                providerId,
                ...(dto.addressId && { addressId: dto.addressId }),
            },
            include: VEHICLE_INCLUDE,
        });
    }

    // ─────────────────────────────────────────
    // List (paginated, filterable)
    // ─────────────────────────────────────────

    async getVehicles(queryStr: QueryString, filters?: { type?: VehicleType; isActive?: boolean }) {
        const features = new PrismaApiFeatures<
            Prisma.VehicleWhereInput,
            Prisma.VehicleInclude,
            Prisma.VehicleOrderByWithRelationInput,
            typeof this.databaseService.vehicle
        >(this.databaseService.vehicle, queryStr)
            .where({
                ...(filters?.type && { type: filters.type }),
                ...(filters?.isActive !== undefined && { isActive: filters.isActive }),
            })
            .search(['name', 'brand', 'model'])
            .filter()
            .sort({ createdAt: 'desc' } as Prisma.VehicleOrderByWithRelationInput)
            .include(VEHICLE_INCLUDE)
            .pagination();

        const { results, totalCount } = await features.execute();
        const page = Number(queryStr.page) || 1;
        const limit = Number(queryStr.limit) || 20;

        return {
            data: results,
            meta: { total: totalCount, page, limit, totalPages: Math.ceil(totalCount / limit) },
        };
    }

    // ─────────────────────────────────────────
    // Get by ID
    // ─────────────────────────────────────────

    async getVehicle(id: string) {
        const vehicle = await this.databaseService.vehicle.findUnique({
            where: { id },
            include: VEHICLE_INCLUDE,
        });
        if (!vehicle) throw new NotFoundException('Vehicle not found');
        return vehicle;
    }

    // ─────────────────────────────────────────
    // Get My Vehicles (provider)
    // ─────────────────────────────────────────

    async getMyVehicles(providerId: string) {
        return this.databaseService.vehicle.findMany({
            where: { providerId },
            include: VEHICLE_INCLUDE,
            orderBy: { createdAt: 'desc' },
        });
    }

    // ─────────────────────────────────────────
    // Update
    // ─────────────────────────────────────────

    async updateVehicle(id: string, providerId: string, dto: Partial<CreateVehicleDto>, skipOwnershipCheck = false) {
        const vehicle = await this.databaseService.vehicle.findUnique({
            where: { id },
            select: { id: true, providerId: true },
        });
        if (!vehicle) throw new NotFoundException('Vehicle not found');
        if (!skipOwnershipCheck && vehicle.providerId !== providerId) {
            throw new ForbiddenException('You do not have permission to update this vehicle');
        }

        if (dto.addressId) {
            await this.validateAddress(dto.addressId);
        }

        // Check registration number uniqueness if being changed
        if (dto.registrationNo) {
            const existing = await this.databaseService.vehicle.findFirst({
                where: { registrationNo: dto.registrationNo, id: { not: id } },
                select: { id: true },
            });
            if (existing) {
                throw new BadRequestException(
                    'A vehicle with this registration number already exists',
                );
            }
        }

        // Explicit mapping — never spread dto directly into Prisma
        const data: Prisma.VehicleUpdateInput = {
            ...(dto.name !== undefined && { name: dto.name }),
            ...(dto.type !== undefined && { type: dto.type }),
            ...(dto.brand !== undefined && { brand: dto.brand }),
            ...(dto.model !== undefined && { model: dto.model }),
            ...(dto.registrationNo !== undefined && { registrationNo: dto.registrationNo }),
            ...(dto.imageUrls !== undefined && { imageUrls: dto.imageUrls }),
            ...(dto.basePricePerDay !== undefined && { basePricePerDay: dto.basePricePerDay }),
            ...(dto.bookingMode !== undefined && { bookingMode: dto.bookingMode }),
            ...(dto.isActive !== undefined && { isActive: dto.isActive }),
            ...(dto.addressId !== undefined && { addressId: dto.addressId || null }),
        };

        return this.databaseService.vehicle.update({
            where: { id },
            data,
            include: VEHICLE_INCLUDE,
        });
    }

    // ─────────────────────────────────────────
    // Delete
    // ─────────────────────────────────────────

    async deleteVehicle(id: string, providerId: string, skipOwnershipCheck = false) {
        const vehicle = await this.databaseService.vehicle.findUnique({
            where: { id },
            select: { id: true, providerId: true },
        });
        if (!vehicle) throw new NotFoundException('Vehicle not found');
        if (!skipOwnershipCheck && vehicle.providerId !== providerId) {
            throw new ForbiddenException('You do not have permission to delete this vehicle');
        }

        // Block hard delete if active bookings exist
        const activeBookings = await this.databaseService.bookingItem.count({
            where: {
                productId: id,
                productType: ProviderType.VEHICLE_PARTNER,
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
                `Cannot delete a vehicle with ${activeBookings} active booking(s). Deactivate instead.`,
            );
        }

        await this.databaseService.vehicle.delete({ where: { id } });
        return { message: 'Vehicle deleted successfully' };
    }

    // ─────────────────────────────────────────
    // Nearby (PostGIS)
    // ─────────────────────────────────────────

    async getNearbyVehicles(
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

        // IDs + distances only — avoids v.* camelCase/snake_case mismatch
        // JOIN not LEFT JOIN, ST_Distance aliased to avoid double computation
        const nearby = await this.databaseService.$queryRaw<Array<{ id: string; distance_meters: number }>>`
            SELECT v.id,
                ST_Distance(
                    a.location,
                    ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
                ) AS distance_meters
            FROM "Vehicle" v
            JOIN "Address" a ON v."addressId" = a.id
            WHERE v."isActive" = true
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

        const vehicles = await this.databaseService.vehicle.findMany({
            where: { id: { in: [...distanceMap.keys()] } },
            include: VEHICLE_INCLUDE,
        });

        return vehicles
            .map(v => ({ ...v, distanceKm: distanceMap.get(v.id) ?? null }))
            .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    }
}