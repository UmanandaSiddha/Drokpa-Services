import { Prisma } from "generated/prisma/client";

/** Lightweight: used in list views — no itinerary */
export const TOUR_LIST_INCLUDE = {
    address: true,
    tags: { include: { tag: true } },
    suggestedTreks: {
        where: { isActive: true },
        orderBy: { displayOrder: 'asc' } as Prisma.TourSuggestedTrekOrderByWithRelationInput,
        include: {
            trek: {
                select: {
                    id: true,
                    title: true,
                    slug: true,
                    type: true,
                    basePrice: true,
                    finalPrice: true,
                    duration: true,
                    imageUrls: true,
                    maxAltitude: true,
                    distance: true,
                    bestSeason: true,
                    isActive: true,
                },
            },
        },
    },
} satisfies Prisma.TourInclude;

/** Full detail: used in single-tour views */
export const TOUR_DETAIL_INCLUDE = {
    address: true,
    tags: { include: { tag: true } },
    suggestedTreks: {
        orderBy: { displayOrder: 'asc' } as Prisma.TourSuggestedTrekOrderByWithRelationInput,
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
    guide: true,
    itinerary: {
        orderBy: { dayNumber: 'asc' } as Prisma.TourItineraryOrderByWithRelationInput,
        include: {
            pois: {
                orderBy: { order: 'asc' } as Prisma.TourItineraryPOIOrderByWithRelationInput,
                include: { poi: true },
            },
        },
    },
} satisfies Prisma.TourInclude;