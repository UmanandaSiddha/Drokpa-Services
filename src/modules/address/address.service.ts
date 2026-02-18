import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/services/database/database.service';
import { CreateAddressDto } from './dto/create-address.dto';

@Injectable()
export class AddressService {
    constructor(
        private readonly databaseService: DatabaseService,
    ) { }

    async createAddress(dto: CreateAddressDto) {
        return this.databaseService.$transaction(async (tx) => {
            const address = await tx.address.create({
                data: { ...dto, country: dto.country || 'India' },
            });
            await tx.$executeRaw`
                UPDATE "Address"
                SET location = ST_SetSRID(ST_MakePoint(${dto.longitude}, ${dto.latitude}), 4326)::geography
                WHERE id = ${address.id}
            `;
            return tx.address.findUnique({ where: { id: address.id } });
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
        const address = await this.databaseService.address.findUnique({ where: { id } });
        if (!address) throw new NotFoundException('Address not found');

        await this.databaseService.$transaction(async (tx) => {
            if (dto.latitude !== undefined || dto.longitude !== undefined) {
                const lat = dto.latitude ?? address.latitude;
                const lon = dto.longitude ?? address.longitude;

                await tx.$executeRaw`
                    UPDATE "Address"
                    SET location = ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)::geography,
                        latitude = ${lat},
                        longitude = ${lon}
                    WHERE id = ${id}
                `;
            }

            const { latitude, longitude, ...rest } = dto;
            if (Object.keys(rest).length > 0) {
                await tx.address.update({ where: { id }, data: rest });
            }
        });

        return this.getAddress(id);
    }

    async getNearbyAddresses(latitude: number, longitude: number, radiusKm: number = 10) {
        const radiusMeters = radiusKm * 1000;

        const nearbyAddresses = await this.databaseService.$queryRaw`
            SELECT 
                id,
                street,
                city,
                state,
                country,
                "postalCode",
                latitude,
                longitude,
                created_at as "createdAt",
                updated_at as "updatedAt",
                ST_Distance(
                    location,
                    ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
                ) as distance
            FROM "Address"
            WHERE ST_DWithin(
                location,
                ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
                ${radiusMeters}
            )
            ORDER BY distance
            LIMIT 50
        `;

        return nearbyAddresses;
    }
}
