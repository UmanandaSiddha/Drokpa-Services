import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "src/services/database/database.service";
import { CreateTourDto } from "./dto/create-tour.dto";
import { AddItineraryDto } from "./dto/add-itinerary.dto";
import { Prisma } from "generated/prisma/client";
import { PrismaApiFeatures, QueryString } from "src/utils/apiFeatures";
import { TOUR_DETAIL_INCLUDE, TOUR_LIST_INCLUDE } from "src/utils/tour.helper";

@Injectable()
export class ToursService {
    constructor(private readonly databaseService: DatabaseService) { }

    // ─────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────

    private computeFinalPrice(basePrice: number, discount: number = 0): number {
        const normalizedDiscount = Math.max(0, Math.min(100, discount));
        return Math.round(basePrice - (basePrice * normalizedDiscount) / 100);
    }

    /**
     * Returns the total confirmed + pending booked seats for a tour.
     * Used to derive availableSpots without a counter column on Tour.
     */
    private async getBookedCount(tourId: string): Promise<number> {
        const result = await this.databaseService.bookingItem.aggregate({
            where: {
                productId: tourId,
                productType: 'TOUR_VENDOR',
                booking: {
                    status: { in: ['CONFIRMED', 'AWAITING_PAYMENT'] },
                },
            },
            _sum: { quantity: true },
        });
        return result._sum.quantity ?? 0;
    }

    /**
     * Validate that all provided tag labels exist in the Tag table.
     * Prevents silent FK errors from Prisma connect.
     */
    private async validateTags(labels: string[]): Promise<void> {
        if (!labels.length) return;
        const found = await this.databaseService.tag.findMany({
            where: { label: { in: labels } },
            select: { label: true },
        });
        const foundSet = new Set(found.map(t => t.label));
        const missing = labels.filter(l => !foundSet.has(l));
        if (missing.length) {
            throw new NotFoundException(
                `Tags not found: ${missing.join(', ')}. Create them before assigning.`,
            );
        }
    }

    // ─────────────────────────────────────────
    // Create
    // ─────────────────────────────────────────

    async createTour(dto: CreateTourDto) {
        if (dto.tags?.length) {
            await this.validateTags(dto.tags);
        }

        const basePrice = dto.price;
        const discount = 0;
        const finalPrice = this.computeFinalPrice(basePrice, discount);

        return this.databaseService.tour.create({
            data: {
                title: dto.title,
                description: dto.description,
                type: dto.type,
                basePrice,
                discount,
                finalPrice,
                duration: dto.duration,
                imageUrls: dto.imageUrls ?? [],
                maxCapacity: dto.maxCapacity ?? 10,
                addressId: dto.addressId,
                about: dto.about,
                included: dto.included ?? [],
                notIncluded: dto.notIncluded ?? [],
                highlights: dto.highlights ?? [],
                brochure: dto.brochure,
                isActive: dto.isActive ?? true,
                ...(dto.tags?.length
                    ? {
                        tags: {
                            create: dto.tags.map(label => ({
                                tag: { connect: { label } },
                            })),
                        },
                    }
                    : {}),
            },
            include: TOUR_LIST_INCLUDE,
        });
    }

    // ─────────────────────────────────────────
    // List (paginated, filterable, sortable)
    // ─────────────────────────────────────────

    async listActiveTours(queryStr: QueryString) {
        const features = new PrismaApiFeatures(
            this.databaseService.tour,
            queryStr,
        )
            .where({ isActive: true })
            .search(['title', 'description'])
            .filter()
            .sort({ rating: 'desc' } as Prisma.TourOrderByWithRelationInput)
            .include(TOUR_LIST_INCLUDE)
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
    // Get by ID (full detail + availability)
    // ─────────────────────────────────────────

    async getTourById(id: string) {
        const [tour, bookedCount] = await Promise.all([
            this.databaseService.tour.findUnique({
                where: { id },
                include: TOUR_DETAIL_INCLUDE,
            }),
            this.getBookedCount(id),
        ]);

        if (!tour) throw new NotFoundException('Tour not found');

        return {
            ...tour,
            availableSpots: Math.max(0, tour.maxCapacity - bookedCount),
        };
    }

    // ─────────────────────────────────────────
    // Update
    // ─────────────────────────────────────────

    async updateTourById(
        id: string,
        dto: Partial<CreateTourDto> & { discount?: number },
    ) {
        const tour = await this.databaseService.tour.findUnique({ where: { id } });
        if (!tour) throw new NotFoundException('Tour not found');

        if (dto.tags?.length) {
            await this.validateTags(dto.tags);
        }

        const nextBasePrice = dto.price ?? tour.basePrice;
        const nextDiscount = dto.discount ?? tour.discount;
        const shouldRecomputeFinal =
            dto.price !== undefined || dto.discount !== undefined;

        // Use Prisma.TourUpdateInput — no manual type maintenance needed
        const data: Prisma.TourUpdateInput = {
            ...(dto.title !== undefined && { title: dto.title }),
            ...(dto.description !== undefined && { description: dto.description }),
            ...(dto.type !== undefined && { type: dto.type }),
            ...(dto.duration !== undefined && { duration: dto.duration }),
            ...(dto.imageUrls !== undefined && { imageUrls: dto.imageUrls }),
            ...(dto.maxCapacity !== undefined && { maxCapacity: dto.maxCapacity }),
            ...(dto.addressId !== undefined && { addressId: dto.addressId }),
            ...(dto.about !== undefined && { about: dto.about }),
            ...(dto.included !== undefined && { included: dto.included }),
            ...(dto.notIncluded !== undefined && { notIncluded: dto.notIncluded }),
            ...(dto.highlights !== undefined && { highlights: dto.highlights }),
            ...(dto.brochure !== undefined && { brochure: dto.brochure }),
            ...(dto.isActive !== undefined && { isActive: dto.isActive }),
            ...(dto.price !== undefined && { basePrice: dto.price }),
            ...(dto.discount !== undefined && { discount: dto.discount }),
            ...(shouldRecomputeFinal && {
                finalPrice: this.computeFinalPrice(nextBasePrice, nextDiscount),
            }),
            ...(dto.tags !== undefined && {
                tags: {
                    deleteMany: {},
                    create: dto.tags.map(label => ({
                        tag: { connect: { label } },
                    })),
                },
            }),
        };

        return this.databaseService.tour.update({
            where: { id },
            data,
            include: TOUR_LIST_INCLUDE,
        });
    }

    // ─────────────────────────────────────────
    // Deactivate (soft delete)
    // ─────────────────────────────────────────

    async deactivateTour(id: string) {
        const tour = await this.databaseService.tour.findUnique({ where: { id } });
        if (!tour) throw new NotFoundException('Tour not found');

        return this.databaseService.tour.update({
            where: { id },
            data: { isActive: false },
        });
    }

    // ─────────────────────────────────────────
    // Itinerary management
    // ─────────────────────────────────────────

    async addTourItineraryDay(tourId: string, dto: AddItineraryDto) {
        const tour = await this.databaseService.tour.findUnique({ where: { id: tourId } });
        if (!tour) throw new NotFoundException('Tour not found');

        try {
            return await this.databaseService.tourItinerary.create({
                data: { tourId, ...dto },
                include: {
                    pois: {
                        include: { poi: true },
                        orderBy: { order: 'asc' },
                    },
                },
            });
        } catch (e) {
            if (
                e instanceof Prisma.PrismaClientKnownRequestError &&
                e.code === 'P2002'
            ) {
                throw new ConflictException(
                    `Day ${dto.dayNumber} already exists for this tour`,
                );
            }
            throw e;
        }
    }

    async addPoiToItinerary(itineraryId: string, poiId: string, order: number) {
        // Parallel existence checks — no need to run sequentially
        const [itinerary, poi] = await Promise.all([
            this.databaseService.tourItinerary.findUnique({ where: { id: itineraryId } }),
            this.databaseService.pOI.findUnique({ where: { id: poiId } }),
        ]);

        if (!itinerary) throw new NotFoundException('Itinerary not found');
        if (!poi) throw new NotFoundException('POI not found');

        try {
            return await this.databaseService.tourItineraryPOI.create({
                data: { itineraryId, poiId, order },
                include: { poi: true },
            });
        } catch (e) {
            if (
                e instanceof Prisma.PrismaClientKnownRequestError &&
                e.code === 'P2002'
            ) {
                throw new ConflictException(
                    'A POI at this order position already exists in the itinerary',
                );
            }
            throw e;
        }
    }

    /**
     * Bulk-reorder all POIs in an itinerary in a single transaction.
     * orderedPoiIds: POI IDs in the desired display order (index = new order value).
     */
    async reorderItineraryPois(
        itineraryId: string,
        orderedPoiIds: string[],
    ): Promise<void> {
        const itinerary = await this.databaseService.tourItinerary.findUnique({
            where: { id: itineraryId },
            include: { pois: true },
        });
        if (!itinerary) throw new NotFoundException('Itinerary not found');

        const existingPoiIds = new Set(itinerary.pois.map(p => p.poiId));
        const invalid = orderedPoiIds.filter(id => !existingPoiIds.has(id));
        if (invalid.length) {
            throw new NotFoundException(
                `POIs not in this itinerary: ${invalid.join(', ')}`,
            );
        }

        await this.databaseService.$transaction(
            orderedPoiIds.map((poiId, index) =>
                this.databaseService.tourItineraryPOI.updateMany({
                    where: { itineraryId, poiId },
                    data: { order: index },
                }),
            ),
        );
    }

    // ─────────────────────────────────────────
    // Nearby tours (PostGIS)
    // ─────────────────────────────────────────

    async findNearbyTours(
        latitude: number,
        longitude: number,
        radiusKm: number = 50,
    ) {
        const radiusMeters = radiusKm * 1000;

        // Step 1 — raw spatial query for IDs + distances only.
        // Avoids t.* pulling snake_case column names that won't map to
        // Prisma's camelCase client (e.g. "addressId" vs "address_id").
        const nearby = await this.databaseService.$queryRaw<
            Array<{ id: string; distance_meters: number }>
        >`
            SELECT t.id,
                   ST_Distance(
                       a.location,
                       ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
                   ) AS distance_meters
            FROM "Tour" t
            JOIN "Address" a ON t."addressId" = a.id
            WHERE t."isActive" = true
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

        // Step 2 — fetch full rows via Prisma for correct typing + relations
        const tours = await this.databaseService.tour.findMany({
            where: { id: { in: [...distanceMap.keys()] } },
            include: TOUR_LIST_INCLUDE,
        });

        // Step 3 — attach distances, re-sort to preserve spatial order
        return tours
            .map(tour => ({
                ...tour,
                distanceKm: distanceMap.get(tour.id) ?? null,
            }))
            .sort(
                (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity),
            );
    }
}