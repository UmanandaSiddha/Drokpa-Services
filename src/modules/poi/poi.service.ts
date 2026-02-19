import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from 'src/services/database/database.service';
import { CreatePOIDto } from './dto/create-poi.dto';
import { PrismaApiFeatures, QueryString } from 'src/utils/apiFeatures';
import { Prisma } from 'generated/prisma/client';

@Injectable()
export class POIService {
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

    async createPOI(dto: CreatePOIDto) {
        if (dto.addressId) {
            await this.validateAddress(dto.addressId);
        }

        return this.databaseService.pOI.create({
            data: {
                name: dto.name,
                description: dto.description,
                specialty: dto.specialty ?? [],
                imageUrls: dto.imageUrls ?? [],
                latitude: dto.latitude,
                longitude: dto.longitude,
                ...(dto.addressId && { addressId: dto.addressId }),
            },
            include: { address: true },
        });
    }

    // ─────────────────────────────────────────
    // List (paginated, searchable)
    // ─────────────────────────────────────────

    async getPOIs(queryStr: QueryString) {
        const features = new PrismaApiFeatures(
            this.databaseService.pOI,
            queryStr,
        )
            .search(['name', 'description'])
            .filter()
            .sort({ createdAt: 'desc' } as Prisma.POIOrderByWithRelationInput)
            .include({ address: true })
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

    async getPOI(id: string) {
        const poi = await this.databaseService.pOI.findUnique({
            where: { id },
            include: {
                address: true,
                tourItineraryItems: {
                    include: {
                        itinerary: {
                            select: {
                                id: true,
                                dayNumber: true,
                                title: true,
                                tour: { select: { id: true, title: true } },
                            },
                        },
                    },
                },
            },
        });

        if (!poi) throw new NotFoundException('POI not found');
        return poi;
    }

    // ─────────────────────────────────────────
    // Nearby (PostGIS — uses stored lat/lng columns, not address.location)
    // ─────────────────────────────────────────

    async getNearbyPOIs(
        latitude: number,
        longitude: number,
        radiusKm: number = 10,
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

        // IDs + distances only — avoids p.* camelCase/snake_case mismatch
        // ST_Distance aliased — ORDER BY references alias, no double computation
        const nearby = await this.databaseService.$queryRaw<Array<{ id: string; distance_meters: number }>>`
            SELECT p.id,
                ST_Distance(
                    ST_SetSRID(ST_MakePoint(p.longitude, p.latitude), 4326)::geography,
                    ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
                ) AS distance_meters
            FROM "POI" p
            WHERE ST_DWithin(
                ST_SetSRID(ST_MakePoint(p.longitude, p.latitude), 4326)::geography,
                ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
                ${radiusMeters}
            )
            ORDER BY distance_meters ASC
        `;

        if (!nearby.length) return [];

        const distanceMap = new Map(
            nearby.map(r => [r.id, Number(r.distance_meters) / 1000]),
        );

        // Single follow-up query with address included — no N+1
        const pois = await this.databaseService.pOI.findMany({
            where: { id: { in: [...distanceMap.keys()] } },
            include: { address: true },
        });

        return pois
            .map(p => ({ ...p, distanceKm: distanceMap.get(p.id) ?? null }))
            .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    }

    // ─────────────────────────────────────────
    // Update
    // ─────────────────────────────────────────

    async updatePOI(id: string, dto: Partial<CreatePOIDto>) {
        const poi = await this.databaseService.pOI.findUnique({
            where: { id },
            select: { id: true },
        });
        if (!poi) throw new NotFoundException('POI not found');

        if (dto.addressId) {
            await this.validateAddress(dto.addressId);
        }

        const data: Prisma.POIUpdateInput = {
            ...(dto.name !== undefined && { name: dto.name }),
            ...(dto.description !== undefined && { description: dto.description }),
            ...(dto.specialty !== undefined && { specialty: dto.specialty }),
            ...(dto.imageUrls !== undefined && { imageUrls: dto.imageUrls }),
            ...(dto.latitude !== undefined && { latitude: dto.latitude }),
            ...(dto.longitude !== undefined && { longitude: dto.longitude }),
            ...(dto.addressId !== undefined && { addressId: dto.addressId || null }),
        };

        return this.databaseService.pOI.update({
            where: { id },
            data,
            include: { address: true },
        });
    }

    // ─────────────────────────────────────────
    // Delete
    // ─────────────────────────────────────────

    async deletePOI(id: string) {
        const poi = await this.databaseService.pOI.findUnique({
            where: { id },
            select: { id: true },
        });
        if (!poi) throw new NotFoundException('POI not found');

        await this.databaseService.pOI.delete({ where: { id } });
        return { message: 'POI deleted successfully' };
    }

    // ─────────────────────────────────────────
    // Link to Itinerary
    // ─────────────────────────────────────────

    async linkToItinerary(poiId: string, itineraryId: string, order: number) {
        if (!Number.isInteger(order) || order < 0) {
            throw new BadRequestException('Order must be a non-negative integer');
        }

        // Parallel existence checks
        const [poi, itinerary] = await Promise.all([
            this.databaseService.pOI.findUnique({
                where: { id: poiId },
                select: { id: true },
            }),
            this.databaseService.tourItinerary.findUnique({
                where: { id: itineraryId },
                select: { id: true },
            }),
        ]);

        if (!poi) throw new NotFoundException('POI not found');
        if (!itinerary) throw new NotFoundException('Itinerary not found');

        // No pre-check — let DB unique constraint handle it and catch P2002
        // Pre-check has a race condition and adds an unnecessary round-trip
        try {
            return await this.databaseService.tourItineraryPOI.create({
                data: { poiId, itineraryId, order },
                include: { poi: true },
            });
        } catch (e) {
            if (
                e instanceof Prisma.PrismaClientKnownRequestError &&
                e.code === 'P2002'
            ) {
                throw new BadRequestException(
                    'POI is already linked to this itinerary at the given order position',
                );
            }
            throw e;
        }
    }
}