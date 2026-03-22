import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "src/services/database/database.service";
import { CreateTourDto, SuggestedTrekConfigDto } from "./dto/create-tour.dto";
import { AddItineraryDto } from "./dto/add-itinerary.dto";
import { Prisma } from "generated/prisma/client";
import { PrismaApiFeatures, QueryString } from "src/utils/apiFeatures";
import { TOUR_DETAIL_INCLUDE, TOUR_LIST_INCLUDE } from "src/utils/tour.helper";
import { generateUniqueSlugFromText } from "src/utils/slug.helper";

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

    private normalizeOptionalText(value?: string): string | undefined {
        if (typeof value !== 'string') return undefined;
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
    }

    private normalizeStringArray(values?: string[]): string[] {
        if (!Array.isArray(values)) return [];
        return values.map(v => String(v).trim()).filter(Boolean);
    }

    private normalizeSuggestedTrekConfigs(
        configs?: SuggestedTrekConfigDto[],
    ): Array<{
        trekId: string;
        rules: string[];
        conditions: string[];
        displayOrder: number;
        isActive: boolean;
    }> {
        if (!Array.isArray(configs)) return [];

        return configs.map((cfg, index) => ({
            trekId: cfg.trekId,
            rules: this.normalizeStringArray(cfg.rules),
            conditions: this.normalizeStringArray(cfg.conditions),
            displayOrder: cfg.displayOrder ?? index,
            isActive: cfg.isActive ?? true,
        }));
    }

    private async validateSuggestedTreks(
        parentType: 'TOUR' | 'TREK',
        suggestedTreks: Array<{ trekId: string }>,
    ): Promise<void> {
        if (!suggestedTreks.length) return;

        if (parentType !== 'TOUR') {
            throw new BadRequestException('Only TOUR entries can define suggested treks');
        }

        const uniqueIds = Array.from(new Set(suggestedTreks.map(cfg => cfg.trekId)));
        const treks = await this.databaseService.tour.findMany({
            where: {
                id: { in: uniqueIds },
                type: 'TREK',
            },
            select: { id: true },
        });

        const trekSet = new Set(treks.map(t => t.id));
        const invalid = uniqueIds.filter(id => !trekSet.has(id));

        if (invalid.length) {
            throw new NotFoundException(
                `Suggested treks are invalid or not found: ${invalid.join(', ')}`,
            );
        }
    }

    private assertTrekSpecificFields(
        type: 'TOUR' | 'TREK',
        fields: {
            maxAltitude?: string;
            distance?: string;
            bestSeason?: string;
            addressId?: string;
        },
    ): void {
        if (type !== 'TREK') return;

        const missing: string[] = [];
        if (!fields.maxAltitude) missing.push('maxAltitude');
        if (!fields.distance) missing.push('distance');
        if (!fields.bestSeason) missing.push('bestSeason');
        if (!fields.addressId) missing.push('addressId');

        if (missing.length) {
            throw new BadRequestException(
                `Trek tours require these fields: ${missing.join(', ')}`,
            );
        }
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

    private async assertTourOwnership(
        id: string,
        providerId?: string,
        skipOwnershipCheck: boolean = false,
    ) {
        const tour = await this.databaseService.tour.findUnique({
            where: { id },
        }) as any;

        if (!tour) throw new NotFoundException('Tour not found');

        if (!skipOwnershipCheck) {
            if (!providerId) {
                throw new BadRequestException('Provider profile not found for current user');
            }
            if (tour.providerId !== providerId) {
                throw new ForbiddenException('You do not have permission to modify this tour');
            }
        }

        return tour;
    }

    // ─────────────────────────────────────────
    // Create
    // ─────────────────────────────────────────

    async createTour(dto: CreateTourDto, providerId?: string) {
        if (dto.tags?.length) {
            await this.validateTags(dto.tags);
        }

        const effectiveProviderId = providerId ?? dto.providerId;
        const effectiveType = dto.type === 'TREK' ? 'TREK' : 'TOUR';

        const maxAltitude = this.normalizeOptionalText(dto.maxAltitude);
        const distance = this.normalizeOptionalText(dto.distance);
        const bestSeason = this.normalizeOptionalText(dto.bestSeason);
        const addressId = this.normalizeOptionalText(dto.addressId);
        const bookingRules = this.normalizeStringArray(dto.bookingRules);
        const bookingConditions = this.normalizeStringArray(dto.bookingConditions);
        const suggestedTreks = this.normalizeSuggestedTrekConfigs(dto.suggestedTreks);

        this.assertTrekSpecificFields(effectiveType, {
            maxAltitude,
            distance,
            bestSeason,
            addressId,
        });

        await this.validateSuggestedTreks(effectiveType, suggestedTreks);

        const basePrice = dto.price;
        const discount = dto.discount ?? 0;
        const finalPrice = this.computeFinalPrice(basePrice, discount);

        // Generate unique slug from title
        const slug = await generateUniqueSlugFromText(
            dto.title,
            async (candidate) => {
                const existing = await this.databaseService.tour.findUnique({
                    where: { slug: candidate },
                });
                return !!existing;
            },
        );

        const createData: any = {
            title: dto.title,
            slug,
            description: dto.description,
            type: effectiveType,
            basePrice,
            discount,
            finalPrice,
            duration: dto.duration,
            maxAltitude: maxAltitude ?? null,
            distance: distance ?? null,
            bestSeason: bestSeason ?? null,
            customDateRequestEnabled: dto.customDateRequestEnabled ?? true,
            customDateMinParticipants: dto.customDateMinParticipants ?? null,
            bookingRules,
            bookingConditions,
            imageUrls: dto.imageUrls ?? [],
            maxCapacity: dto.maxCapacity ?? 10,
            addressId: addressId ?? null,
            providerId: effectiveProviderId,
            guideId: dto.guideId,
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
            ...(suggestedTreks.length
                ? {
                    suggestedTreks: {
                        create: suggestedTreks.map((cfg, index) => ({
                            trekId: cfg.trekId,
                            rules: cfg.rules,
                            conditions: cfg.conditions,
                            displayOrder: cfg.displayOrder ?? index,
                            isActive: cfg.isActive,
                        })),
                    },
                }
                : {}),
        };

        return this.databaseService.tour.create({
            data: createData,
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

    async listAllTours(queryStr: QueryString) {
        const features = new PrismaApiFeatures(
            this.databaseService.tour,
            queryStr,
        )
            .search(['title', 'description'])
            .filter()
            .sort({ createdAt: 'desc' } as Prisma.TourOrderByWithRelationInput)
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

    async listProviderTours(providerId: string, queryStr: QueryString) {
        const features = new PrismaApiFeatures(
            this.databaseService.tour,
            queryStr,
        )
            .where({ providerId })
            .search(['title', 'description'])
            .filter()
            .sort({ createdAt: 'desc' } as Prisma.TourOrderByWithRelationInput)
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
    // Get by Slug (SEO-friendly URL)
    // ─────────────────────────────────────────

    async getTourBySlug(slug: string) {
        const tour = await this.databaseService.tour.findUnique({
            where: { slug },
            include: TOUR_DETAIL_INCLUDE,
        });

        if (!tour) throw new NotFoundException('Tour not found');

        const bookedCount = await this.getBookedCount(tour.id);

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
        providerId?: string,
        skipOwnershipCheck = false,
    ) {
        const tour = await this.assertTourOwnership(id, providerId, skipOwnershipCheck);

        const normalizedType =
            dto.type === 'TOUR' || dto.type === 'TREK'
                ? dto.type
                : undefined;
        const nextType = normalizedType ?? tour.type;

        const nextMaxAltitude =
            dto.maxAltitude !== undefined
                ? this.normalizeOptionalText(dto.maxAltitude)
                : (tour.maxAltitude ?? undefined);
        const nextDistance =
            dto.distance !== undefined
                ? this.normalizeOptionalText(dto.distance)
                : (tour.distance ?? undefined);
        const nextBestSeason =
            dto.bestSeason !== undefined
                ? this.normalizeOptionalText(dto.bestSeason)
                : (tour.bestSeason ?? undefined);
        const nextAddressId =
            dto.addressId !== undefined
                ? this.normalizeOptionalText(dto.addressId)
                : (tour.addressId ?? undefined);
        const normalizedSuggestedTreks =
            dto.suggestedTreks !== undefined
                ? this.normalizeSuggestedTrekConfigs(dto.suggestedTreks)
                : undefined;
        const nextBookingRules =
            dto.bookingRules !== undefined
                ? this.normalizeStringArray(dto.bookingRules)
                : (Array.isArray(tour.bookingRules) ? tour.bookingRules : []);
        const nextBookingConditions =
            dto.bookingConditions !== undefined
                ? this.normalizeStringArray(dto.bookingConditions)
                : (Array.isArray(tour.bookingConditions) ? tour.bookingConditions : []);

        this.assertTrekSpecificFields(nextType, {
            maxAltitude: nextMaxAltitude,
            distance: nextDistance,
            bestSeason: nextBestSeason,
            addressId: nextAddressId,
        });

        if (normalizedSuggestedTreks !== undefined) {
            await this.validateSuggestedTreks(nextType, normalizedSuggestedTreks);
        }

        if (dto.tags?.length) {
            await this.validateTags(dto.tags);
        }

        const nextBasePrice = dto.price ?? tour.basePrice;
        const nextDiscount = dto.discount ?? tour.discount;
        const shouldRecomputeFinal =
            dto.price !== undefined || dto.discount !== undefined;

        // Regenerate slug if title changes
        let slug = tour.slug;
        if (dto.title && dto.title !== tour.title) {
            slug = await generateUniqueSlugFromText(
                dto.title,
                async (candidate) => {
                    const existing = await this.databaseService.tour.findUnique({
                        where: { slug: candidate },
                    });
                    // Allow the current tour's slug to match itself
                    return !!existing && existing.id !== id;
                },
            );
        }

        // Use Prisma.TourUpdateInput — no manual type maintenance needed
        const data: any = {
            ...(dto.title !== undefined && { title: dto.title }),
            ...(dto.title !== undefined && { slug }),
            ...(dto.description !== undefined && { description: dto.description }),
            ...(normalizedType !== undefined && { type: normalizedType }),
            ...(dto.duration !== undefined && { duration: dto.duration }),
            ...(dto.maxAltitude !== undefined && {
                maxAltitude: this.normalizeOptionalText(dto.maxAltitude) ?? null,
            }),
            ...(dto.distance !== undefined && {
                distance: this.normalizeOptionalText(dto.distance) ?? null,
            }),
            ...(dto.bestSeason !== undefined && {
                bestSeason: this.normalizeOptionalText(dto.bestSeason) ?? null,
            }),
            ...(dto.customDateRequestEnabled !== undefined && {
                customDateRequestEnabled: dto.customDateRequestEnabled,
            }),
            ...(dto.customDateMinParticipants !== undefined && {
                customDateMinParticipants: dto.customDateMinParticipants,
            }),
            ...(dto.bookingRules !== undefined && {
                bookingRules: this.normalizeStringArray(dto.bookingRules),
            }),
            ...(dto.bookingConditions !== undefined && {
                bookingConditions: this.normalizeStringArray(dto.bookingConditions),
            }),
            ...(dto.imageUrls !== undefined && { imageUrls: dto.imageUrls }),
            ...(dto.maxCapacity !== undefined && { maxCapacity: dto.maxCapacity }),
            ...(dto.addressId !== undefined && {
                addressId: this.normalizeOptionalText(dto.addressId) ?? null,
            }),
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
            ...(normalizedType === 'TOUR' && {
                maxAltitude: null,
                distance: null,
                bestSeason: null,
            }),
            ...(normalizedType === 'TREK' && {
                suggestedTreks: {
                    deleteMany: {},
                },
                bookingRules: nextBookingRules,
                bookingConditions: nextBookingConditions,
            }),
            ...(normalizedSuggestedTreks !== undefined && normalizedType !== 'TREK' && {
                suggestedTreks: {
                    deleteMany: {},
                    create: normalizedSuggestedTreks.map((cfg, index) => ({
                        trekId: cfg.trekId,
                        rules: cfg.rules,
                        conditions: cfg.conditions,
                        displayOrder: cfg.displayOrder ?? index,
                        isActive: cfg.isActive,
                    })),
                },
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

    async getSuggestedTreksForTour(tourId: string, participants?: number) {
        const tour = await this.databaseService.tour.findUnique({
            where: { id: tourId },
            include: {
                suggestedTreks: {
                    where: { isActive: true },
                    orderBy: { displayOrder: 'asc' },
                    include: {
                        trek: {
                            select: {
                                id: true,
                                title: true,
                                slug: true,
                                description: true,
                                type: true,
                                duration: true,
                                basePrice: true,
                                finalPrice: true,
                                imageUrls: true,
                                maxAltitude: true,
                                distance: true,
                                bestSeason: true,
                                isActive: true,
                            },
                        },
                    },
                },
            },
        });

        if (!tour) {
            throw new NotFoundException('Tour not found');
        }

        if (tour.type !== 'TOUR') {
            throw new BadRequestException('Suggested trek API is available only for TOUR entries');
        }

        const normalizedParticipants =
            typeof participants === 'number' && Number.isFinite(participants) && participants > 0
                ? Math.floor(participants)
                : 1;

        return {
            tourId: tour.id,
            participants: normalizedParticipants,
            suggestions: tour.suggestedTreks
                .filter(item => item.trek?.isActive)
                .map(item => ({
                    id: item.id,
                    rules: item.rules,
                    conditions: item.conditions,
                    displayOrder: item.displayOrder,
                    trek: item.trek,
                    estimatedTotalAmount: (item.trek?.finalPrice ?? 0) * normalizedParticipants,
                })),
        };
    }

    // ─────────────────────────────────────────
    // Deactivate (soft delete)
    // ─────────────────────────────────────────

    async deactivateTour(id: string, providerId?: string, skipOwnershipCheck = false) {
        await this.assertTourOwnership(id, providerId, skipOwnershipCheck);

        return this.databaseService.tour.update({
            where: { id },
            data: { isActive: false },
        });
    }

    // ─────────────────────────────────────────
    // Itinerary management
    // ─────────────────────────────────────────

    async addTourItineraryDay(
        tourId: string,
        dto: AddItineraryDto,
        providerId?: string,
        skipOwnershipCheck = false,
    ) {
        await this.assertTourOwnership(tourId, providerId, skipOwnershipCheck);

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

    async getTourItinerary(tourId: string) {
        const tour = await this.databaseService.tour.findUnique({ where: { id: tourId } });
        if (!tour) throw new NotFoundException('Tour not found');

        return this.databaseService.tourItinerary.findMany({
            where: { tourId },
            include: {
                pois: {
                    include: { poi: true },
                    orderBy: { order: 'asc' },
                },
            },
            orderBy: { dayNumber: 'asc' },
        });
    }

    async updateItineraryDay(
        tourId: string,
        dayNumber: number,
        dto: Partial<AddItineraryDto>,
        providerId?: string,
        skipOwnershipCheck = false,
    ) {
        await this.assertTourOwnership(tourId, providerId, skipOwnershipCheck);

        const itinerary = await this.databaseService.tourItinerary.findUnique({
            where: { tourId_dayNumber: { tourId, dayNumber } },
        });

        if (!itinerary) {
            throw new NotFoundException(
                `Itinerary day ${dayNumber} not found for this tour`,
            );
        }

        return this.databaseService.tourItinerary.update({
            where: { id: itinerary.id },
            data: {
                ...(dto.title !== undefined && { title: dto.title }),
                ...(dto.details !== undefined && { details: dto.details }),
            },
            include: {
                pois: {
                    include: { poi: true },
                    orderBy: { order: 'asc' },
                },
            },
        });
    }

    async deleteItineraryDay(
        tourId: string,
        dayNumber: number,
        providerId?: string,
        skipOwnershipCheck = false,
    ) {
        await this.assertTourOwnership(tourId, providerId, skipOwnershipCheck);

        const itinerary = await this.databaseService.tourItinerary.findUnique({
            where: { tourId_dayNumber: { tourId, dayNumber } },
        });

        if (!itinerary) {
            throw new NotFoundException(
                `Itinerary day ${dayNumber} not found for this tour`,
            );
        }

        return this.databaseService.tourItinerary.delete({
            where: { id: itinerary.id },
        });
    }

    async addPoiToItinerary(
        itineraryId: string,
        poiId: string,
        order: number,
        providerId?: string,
        skipOwnershipCheck = false,
    ) {
        // Parallel existence checks — no need to run sequentially
        const [itinerary, poi] = await Promise.all([
            this.databaseService.tourItinerary.findUnique({ where: { id: itineraryId } }),
            this.databaseService.pOI.findUnique({ where: { id: poiId } }),
        ]);

        if (!itinerary) throw new NotFoundException('Itinerary not found');
        await this.assertTourOwnership(itinerary.tourId, providerId, skipOwnershipCheck);
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
        providerId?: string,
        skipOwnershipCheck = false,
    ): Promise<void> {
        const itinerary = await this.databaseService.tourItinerary.findUnique({
            where: { id: itineraryId },
            include: { pois: true },
        });
        if (!itinerary) throw new NotFoundException('Itinerary not found');

        await this.assertTourOwnership(itinerary.tourId, providerId, skipOwnershipCheck);

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

    async removePOIFromItinerary(
        itineraryId: string,
        poiId: string,
        providerId?: string,
        skipOwnershipCheck = false,
    ) {
        const entry = await this.databaseService.tourItineraryPOI.findFirst({
            where: { itineraryId, poiId },
            include: {
                itinerary: {
                    select: { tourId: true },
                },
            },
        });

        if (!entry) {
            throw new NotFoundException('POI not found in this itinerary');
        }

        await this.assertTourOwnership(entry.itinerary.tourId, providerId, skipOwnershipCheck);

        return this.databaseService.tourItineraryPOI.delete({
            where: { id: entry.id },
        });
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

    // ─────────────────────────────────────────
    // Suggested Trek Management (Admin only)
    // ─────────────────────────────────────────

    async addSuggestedTrek(
        tourId: string,
        trekId: string,
        dto: { rules?: string[]; conditions?: string[]; displayOrder?: number; isActive?: boolean },
        providerId?: string,
        skipOwnershipCheck = false,
    ) {
        await this.assertTourOwnership(tourId, providerId, skipOwnershipCheck);

        // Verify trek exists and is active
        const trek = await this.databaseService.tour.findUnique({
            where: { id: trekId },
            select: { id: true, type: true, isActive: true },
        });

        if (!trek) {
            throw new NotFoundException('Trek not found');
        }

        if (trek.type !== 'TREK') {
            throw new BadRequestException('Only TREK entries can be suggested as add-ons');
        }

        try {
            return await this.databaseService.tourSuggestedTrek.create({
                data: {
                    tourId,
                    trekId,
                    rules: dto.rules ?? [],
                    conditions: dto.conditions ?? [],
                    displayOrder: dto.displayOrder ?? 0,
                    isActive: dto.isActive ?? true,
                },
                include: {
                    trek: {
                        select: {
                            id: true,
                            title: true,
                            slug: true,
                            basePrice: true,
                            finalPrice: true,
                            duration: true,
                            isActive: true,
                        },
                    },
                },
            });
        } catch (e) {
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                throw new ConflictException('This trek is already suggested for this tour');
            }
            throw e;
        }
    }

    async updateSuggestedTrek(
        suggestedTrekId: string,
        dto: { rules?: string[]; conditions?: string[]; displayOrder?: number; isActive?: boolean },
        providerId?: string,
        skipOwnershipCheck = false,
    ) {
        const suggestedTrek = await this.databaseService.tourSuggestedTrek.findUnique({
            where: { id: suggestedTrekId },
            select: { tourId: true },
        });

        if (!suggestedTrek) {
            throw new NotFoundException('Suggested trek not found');
        }

        await this.assertTourOwnership(suggestedTrek.tourId, providerId, skipOwnershipCheck);

        return this.databaseService.tourSuggestedTrek.update({
            where: { id: suggestedTrekId },
            data: {
                ...(dto.rules !== undefined && { rules: dto.rules }),
                ...(dto.conditions !== undefined && { conditions: dto.conditions }),
                ...(dto.displayOrder !== undefined && { displayOrder: dto.displayOrder }),
                ...(dto.isActive !== undefined && { isActive: dto.isActive }),
            },
            include: {
                trek: {
                    select: {
                        id: true,
                        title: true,
                        slug: true,
                        basePrice: true,
                        finalPrice: true,
                        duration: true,
                        isActive: true,
                    },
                },
            },
        });
    }

    async removeSuggestedTrek(
        suggestedTrekId: string,
        providerId?: string,
        skipOwnershipCheck = false,
    ) {
        const suggestedTrek = await this.databaseService.tourSuggestedTrek.findUnique({
            where: { id: suggestedTrekId },
            select: { tourId: true, trekId: true },
        });

        if (!suggestedTrek) {
            throw new NotFoundException('Suggested trek not found');
        }

        await this.assertTourOwnership(suggestedTrek.tourId, providerId, skipOwnershipCheck);

        await this.databaseService.tourSuggestedTrek.delete({
            where: { id: suggestedTrekId },
        });

        return { message: 'Suggested trek removed successfully' };
    }
}