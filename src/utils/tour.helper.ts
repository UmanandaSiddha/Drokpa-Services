import { Prisma } from "generated/prisma/client";

/** Lightweight: used in list views — no itinerary */
export const TOUR_LIST_INCLUDE = {
    address: true,
    tags: { include: { tag: true } },
} satisfies Prisma.TourInclude;

/** Full detail: used in single-tour views */
export const TOUR_DETAIL_INCLUDE = {
    address: true,
    tags: { include: { tag: true } },
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