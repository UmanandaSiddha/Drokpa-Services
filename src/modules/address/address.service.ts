import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/services/database/database.service';
import { CreateAddressDto } from './dto/create-address.dto';

@Injectable()
export class AddressService {
    constructor(
        private readonly databaseService: DatabaseService,
    ) { }

    async createAddress(dto: CreateAddressDto) {
        return this.databaseService.address.create({
            data: {
                ...dto,
                country: dto.country || 'India',
            },
        });
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

        return this.databaseService.address.update({
            where: { id },
            data: dto,
        });
    }

    async getNearbyAddresses(latitude: number, longitude: number, radiusKm: number = 10) {
        // For now, simple distance calculation
        // In production with PostGIS, use ST_DWithin for accurate queries
        const allAddresses = await this.databaseService.address.findMany();

        const nearbyAddresses = allAddresses.filter(address => {
            const distance = this.calculateDistance(
                latitude,
                longitude,
                address.latitude,
                address.longitude,
            );
            return distance <= radiusKm;
        });

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
