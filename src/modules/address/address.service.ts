import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/services/database/database.service';
import { CreateAddressDto } from './dto/create-address.dto';

@Injectable()
export class AddressService {
    constructor(
        private readonly databaseService: DatabaseService,
    ) { }

    async createAddress(dto: CreateAddressDto) {
        // Create address with basic fields first
        const address = await this.databaseService.address.create({
            data: {
                ...dto,
                country: dto.country || 'India',
            },
        });

        // Update location field using PostGIS
        await this.databaseService.$executeRaw`
            UPDATE "Address"
            SET location = ST_SetSRID(ST_MakePoint(${dto.longitude}, ${dto.latitude}), 4326)::geography
            WHERE id = ${address.id}
        `;

        return this.getAddress(address.id);
    }

    async getAddress(id: string) {
        const address = await this.databaseService.address.findUnique({
            where: { id },
        });

        if (!address) {
            throw new NotFoundException('Address not found');
        }

        return address;
    }

    async updateAddress(id: string, dto: Partial<CreateAddressDto>) {
        const address = await this.databaseService.address.findUnique({
            where: { id },
        });

        if (!address) {
            throw new NotFoundException('Address not found');
        }

        // If latitude or longitude changed, update location field using PostGIS
        if (dto.latitude !== undefined || dto.longitude !== undefined) {
            const lat = dto.latitude ?? address.latitude;
            const lon = dto.longitude ?? address.longitude;
            
            // Update location using PostGIS
            await this.databaseService.$executeRaw`
                UPDATE "Address"
                SET location = ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)::geography
                WHERE id = ${id}
            `;
        }

        // Update other fields using Prisma
        const updateData: any = { ...dto };
        delete updateData.latitude;
        delete updateData.longitude;
        
        if (Object.keys(updateData).length > 0) {
            await this.databaseService.address.update({
                where: { id },
                data: updateData,
            });
        }

        return this.getAddress(id);
    }

    async getNearbyAddresses(latitude: number, longitude: number, radiusKm: number = 10) {
        const radiusMeters = radiusKm * 1000;

        const nearbyAddresses = await this.databaseService.$queryRaw`
            SELECT 
                id, street, city, state, country, "postalCode", latitude, longitude, 
                created_at, updated_at,
                ST_Distance(location, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography) as distance
            FROM "Address"
            WHERE ST_DWithin(
                location,
                ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
                ${radiusMeters}
            )
            ORDER BY ST_Distance(
                location,
                ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
            )
        `;

        return nearbyAddresses;
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
