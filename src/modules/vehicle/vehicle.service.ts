import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { DatabaseService } from 'src/services/database/database.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';

@Injectable()
export class VehicleService {
    constructor(
        private readonly databaseService: DatabaseService,
    ) { }

    async createVehicle(providerId: string, dto: CreateVehicleDto) {
        // Check if registration number already exists
        const existing = await this.databaseService.vehicle.findUnique({
            where: { registrationNo: dto.registrationNo },
        });

        if (existing) {
            throw new BadRequestException('Vehicle with this registration number already exists');
        }

        return this.databaseService.vehicle.create({
            data: {
                ...dto,
                providerId,
            },
        });
    }

    async getVehicles(filters?: { type?: string; isActive?: boolean; providerId?: string }) {
        return this.databaseService.vehicle.findMany({
            where: {
                ...(filters?.type && { type: filters.type as any }),
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
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getVehicle(id: string) {
        const vehicle = await this.databaseService.vehicle.findUnique({
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

        if (!vehicle) {
            throw new NotFoundException('Vehicle not found');
        }

        return vehicle;
    }

    async updateVehicle(id: string, providerId: string, dto: Partial<CreateVehicleDto>) {
        const vehicle = await this.databaseService.vehicle.findUnique({
            where: { id },
        });

        if (!vehicle) {
            throw new NotFoundException('Vehicle not found');
        }

        if (vehicle.providerId !== providerId) {
            throw new ForbiddenException('You do not have permission to update this vehicle');
        }

        return this.databaseService.vehicle.update({
            where: { id },
            data: dto,
        });
    }

    async deleteVehicle(id: string, providerId: string) {
        const vehicle = await this.databaseService.vehicle.findUnique({
            where: { id },
        });

        if (!vehicle) {
            throw new NotFoundException('Vehicle not found');
        }

        if (vehicle.providerId !== providerId) {
            throw new ForbiddenException('You do not have permission to delete this vehicle');
        }

        await this.databaseService.vehicle.delete({
            where: { id },
        });

        return { message: 'Vehicle deleted successfully' };
    }

    async getMyVehicles(providerId: string) {
        return this.databaseService.vehicle.findMany({
            where: { providerId },
            include: {
                address: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getNearbyVehicles(latitude: number, longitude: number, radiusKm: number = 20) {
        const radiusMeters = radiusKm * 1000;

        const nearbyVehicles = await this.databaseService.$queryRaw<Array<{
            id: string;
            name: string;
            type: string;
            brand: string | null;
            model: string | null;
            registrationNo: string;
            imageUrls: string[];
            basePricePerDay: number;
            bookingMode: string[];
            isActive: boolean;
            providerId: string;
            addressId: string | null;
            distance: number;
        }>>`
            SELECT 
                v.*,
                ST_Distance(
                    a.location,
                    ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
                ) as distance
            FROM "Vehicle" v
            LEFT JOIN "Address" a ON v."addressId" = a.id
            WHERE v."isActive" = true
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

        // Fetch full vehicle data with relations
        const vehicleIds = nearbyVehicles.map(v => v.id);
        const vehicles = await this.databaseService.vehicle.findMany({
            where: { id: { in: vehicleIds } },
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

        // Map distances to vehicles
        return vehicles.map(vehicle => {
            const vehicleData = nearbyVehicles.find(v => v.id === vehicle.id);
            return {
                ...vehicle,
                distance: vehicleData ? Number(vehicleData.distance) / 1000 : null, // Convert meters to km
            };
        });
    }
}
