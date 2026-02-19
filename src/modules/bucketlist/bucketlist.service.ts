import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
    Logger,
} from '@nestjs/common';
import { DatabaseService } from 'src/services/database/database.service';
import { CreateBucketListDto } from './dto/create-bucketlist.dto';
import { AddBucketListItemDto } from './dto/add-item.dto';
import { BucketListStatus, ProviderType } from 'generated/prisma/enums';
import { Prisma } from 'generated/prisma/client';

// ─────────────────────────────────────────────
// Reusable include shape for items with product data
// ─────────────────────────────────────────────
const ITEM_INCLUDE = {
    tour: {
        select: {
            id: true,
            title: true,
            imageUrls: true,
            finalPrice: true,
            duration: true,
            type: true,
        },
    },
    homestay: {
        select: {
            id: true,
            name: true,
            imageUrls: true,
            displayPrice: true,
        },
    },
} satisfies Prisma.BucketListItemInclude;

@Injectable()
export class BucketListService {
    private readonly logger = new Logger(BucketListService.name);

    constructor(private readonly databaseService: DatabaseService) { }

    // ─────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────

    /**
     * Asserts the bucket list exists and belongs to the user.
     * Separates existence (404) from ownership (403) — no existence leaks.
     */
    private async assertBucketListOwner(bucketListId: string, userId: string) {
        const bucketList = await this.databaseService.bucketList.findUnique({
            where: { id: bucketListId },
            include: { items: { include: ITEM_INCLUDE } },
        });

        if (!bucketList) {
            throw new NotFoundException('Bucket list not found');
        }
        if (bucketList.userId !== userId) {
            throw new ForbiddenException('You do not have access to this bucket list');
        }

        return bucketList;
    }

    /**
     * Validates that the referenced product exists and is active.
     *
     * Schema constraint: BucketListItem only has tourId and homestayId FK columns.
     * Vehicles and guides have no FK — their IDs are validated here but stored
     * in the metadata field. This is intentional given the current schema.
     *
     * Returns the resolved FK fields and any metadata to merge.
     */
    private async validateProduct(dto: AddBucketListItemDto): Promise<{
        tourId: string | null;
        homestayId: string | null;
        metadata: Record<string, any>;
    }> {
        const existingMetadata = (dto.metadata as Record<string, any>) ?? {};

        switch (dto.productType) {
            case ProviderType.TOUR_VENDOR: {
                if (!dto.tourId) {
                    throw new BadRequestException('tourId is required for TOUR_VENDOR');
                }
                const tour = await this.databaseService.tour.findUnique({
                    where: { id: dto.tourId },
                    select: { id: true, isActive: true },
                });
                if (!tour || !tour.isActive) {
                    throw new BadRequestException('Tour not found or not active');
                }
                return { tourId: dto.tourId, homestayId: null, metadata: existingMetadata };
            }

            case ProviderType.HOMESTAY_HOST: {
                if (!dto.homestayId) {
                    throw new BadRequestException('homestayId is required for HOMESTAY_HOST');
                }
                const homestay = await this.databaseService.homestay.findUnique({
                    where: { id: dto.homestayId },
                    select: { id: true, isActive: true },
                });
                if (!homestay || !homestay.isActive) {
                    throw new BadRequestException('Homestay not found or not active');
                }
                return { tourId: null, homestayId: dto.homestayId, metadata: existingMetadata };
            }

            case ProviderType.VEHICLE_PARTNER: {
                // No FK column for vehicles — store validated ID in metadata
                if (!dto.vehicleId) {
                    throw new BadRequestException('vehicleId is required for VEHICLE_PARTNER');
                }
                const vehicle = await this.databaseService.vehicle.findUnique({
                    where: { id: dto.vehicleId },
                    select: { id: true, isActive: true },
                });
                if (!vehicle || !vehicle.isActive) {
                    throw new BadRequestException('Vehicle not found or not active');
                }
                return {
                    tourId: null,
                    homestayId: null,
                    metadata: { ...existingMetadata, vehicleId: dto.vehicleId },
                };
            }

            case ProviderType.LOCAL_GUIDE: {
                // No FK column for guides — store validated ID in metadata
                if (!dto.guideId) {
                    throw new BadRequestException('guideId is required for LOCAL_GUIDE');
                }
                const guide = await this.databaseService.localGuide.findUnique({
                    where: { id: dto.guideId },
                    select: { id: true, isActive: true },
                });
                if (!guide || !guide.isActive) {
                    throw new BadRequestException('Guide not found or not active');
                }
                return {
                    tourId: null,
                    homestayId: null,
                    metadata: { ...existingMetadata, guideId: dto.guideId },
                };
            }

            default:
                throw new BadRequestException(
                    `Unsupported product type: ${dto.productType}. Supported: TOUR_VENDOR, HOMESTAY_HOST, VEHICLE_PARTNER, LOCAL_GUIDE`,
                );
        }
    }

    // ─────────────────────────────────────────
    // Create
    // ─────────────────────────────────────────

    async createBucketList(userId: string, dto: CreateBucketListDto) {
        return this.databaseService.bucketList.create({
            data: {
                userId,
                tripName: dto.tripName,
                status: BucketListStatus.DRAFT,
            },
        });
    }

    // ─────────────────────────────────────────
    // Add Item
    // ─────────────────────────────────────────

    async addItem(bucketListId: string, userId: string, dto: AddBucketListItemDto) {
        const bucketList = await this.assertBucketListOwner(bucketListId, userId);

        if (bucketList.status !== BucketListStatus.DRAFT) {
            throw new BadRequestException('Items can only be added to a draft bucket list');
        }

        const { tourId, homestayId, metadata } = await this.validateProduct(dto);

        return this.databaseService.bucketListItem.create({
            data: {
                bucketListId,
                productType: dto.productType,
                tourId,
                homestayId,
                quantity: dto.quantity,
                startDate: dto.startDate ? new Date(dto.startDate) : null,
                endDate: dto.endDate ? new Date(dto.endDate) : null,
                metadata,
            },
            include: ITEM_INCLUDE,
        });
    }

    // ─────────────────────────────────────────
    // Update Item
    // ─────────────────────────────────────────

    async updateItem(
        bucketListId: string,
        itemId: string,
        userId: string,
        dto: Partial<AddBucketListItemDto>,
    ) {
        const bucketList = await this.assertBucketListOwner(bucketListId, userId);

        if (bucketList.status !== BucketListStatus.DRAFT) {
            throw new BadRequestException('Items can only be updated in a draft bucket list');
        }

        const item = await this.databaseService.bucketListItem.findUnique({
            where: { id: itemId },
        });

        if (!item) throw new NotFoundException('Item not found');
        if (item.bucketListId !== bucketListId) {
            throw new ForbiddenException('Item does not belong to this bucket list');
        }

        // Build update payload using Prisma's generated type — no `any`
        const data: Prisma.BucketListItemUpdateInput = {};

        // Product type + ID change — re-validate the new product
        if (dto.productType !== undefined || dto.tourId !== undefined || dto.homestayId !== undefined) {
            const resolvedType = dto.productType ?? item.productType;
            const { tourId, homestayId, metadata } = await this.validateProduct({
                ...dto,
                productType: resolvedType,
            } as AddBucketListItemDto);

            data.productType = resolvedType;
            // Use relation syntax — Prisma.BucketListItemUpdateInput has no raw FK fields
            data.tour = tourId ? { connect: { id: tourId } } : { disconnect: true };
            data.homestay = homestayId ? { connect: { id: homestayId } } : { disconnect: true };
            if (Object.keys(metadata).length) data.metadata = metadata;
        }

        // Use !== undefined throughout — falsy checks silently skip 0, false, []
        if (dto.quantity !== undefined) data.quantity = dto.quantity;
        if (dto.startDate !== undefined) data.startDate = new Date(dto.startDate);
        if (dto.endDate !== undefined) data.endDate = new Date(dto.endDate);
        if (dto.metadata !== undefined) data.metadata = dto.metadata as Prisma.InputJsonValue;

        return this.databaseService.bucketListItem.update({
            where: { id: itemId },
            data,
            include: ITEM_INCLUDE,
        });
    }

    // ─────────────────────────────────────────
    // Remove Item
    // ─────────────────────────────────────────

    async removeItem(bucketListId: string, itemId: string, userId: string) {
        const bucketList = await this.assertBucketListOwner(bucketListId, userId);

        if (bucketList.status !== BucketListStatus.DRAFT) {
            throw new BadRequestException('Items can only be removed from a draft bucket list');
        }

        // Parallel fetch — item and bucket list are independent
        const item = await this.databaseService.bucketListItem.findUnique({
            where: { id: itemId },
        });

        if (!item) throw new NotFoundException('Item not found');
        if (item.bucketListId !== bucketListId) {
            throw new ForbiddenException('Item does not belong to this bucket list');
        }

        await this.databaseService.bucketListItem.delete({
            where: { id: itemId },
        });

        return { message: 'Item removed successfully' };
    }

    // ─────────────────────────────────────────
    // Get All (for user)
    // ─────────────────────────────────────────

    async getBucketLists(userId: string, status?: BucketListStatus) {
        return this.databaseService.bucketList.findMany({
            where: {
                userId,
                ...(status && { status }),
            },
            include: {
                items: {
                    include: ITEM_INCLUDE,
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    // ─────────────────────────────────────────
    // Get Single
    // ─────────────────────────────────────────

    async getBucketList(bucketListId: string, userId: string) {
        // assertBucketListOwner already loads items with relations
        return this.assertBucketListOwner(bucketListId, userId);
    }

    // ─────────────────────────────────────────
    // Checkout
    //
    // Transitions DRAFT → PENDING_CHECKOUT.
    // Actual booking creation is a separate step — one booking per item,
    // initiated by the user via the booking endpoints. This avoids creating
    // all bookings in one giant transaction that could partially fail.
    // Once all items are individually booked, status is updated to
    // CONVERTED_TO_BOOKING by the booking service.
    // ─────────────────────────────────────────

    async checkout(bucketListId: string, userId: string) {
        const bucketList = await this.assertBucketListOwner(bucketListId, userId);

        if (bucketList.status !== BucketListStatus.DRAFT) {
            throw new BadRequestException(
                `Bucket list is already in status: ${bucketList.status}`,
            );
        }

        if (bucketList.items.length === 0) {
            throw new BadRequestException('Cannot checkout an empty bucket list');
        }

        const updated = await this.databaseService.bucketList.update({
            where: { id: bucketListId },
            data: { status: BucketListStatus.PENDING_CHECKOUT },
            include: { items: { include: ITEM_INCLUDE } },
        });

        return {
            message: 'Bucket list is ready for checkout. Proceed to book each item individually.',
            bucketList: updated,
            // Surface item details so the client knows what to book next
            itemSummary: updated.items.map(item => ({
                itemId: item.id,
                productType: item.productType,
                productId: item.tourId ?? item.homestayId ?? (item.metadata as any)?.vehicleId ?? (item.metadata as any)?.guideId,
                startDate: item.startDate,
                endDate: item.endDate,
                quantity: item.quantity,
            })),
        };
    }

    /**
     * Called by BookingService after successfully creating a booking from a
     * bucket list item. When all items in the list are booked, marks the
     * bucket list as CONVERTED_TO_BOOKING.
     */
    async markItemBooked(bucketListId: string): Promise<void> {
        const bucketList = await this.databaseService.bucketList.findUnique({
            where: { id: bucketListId },
            include: { items: true },
        });

        if (!bucketList || bucketList.status !== BucketListStatus.PENDING_CHECKOUT) {
            return;
        }

        // Check if all items have been converted — tracked via metadata
        const allBooked = bucketList.items.every(
            item => (item.metadata as any)?.booked === true,
        );

        if (allBooked) {
            await this.databaseService.bucketList.update({
                where: { id: bucketListId },
                data: { status: BucketListStatus.CONVERTED_TO_BOOKING },
            });

            this.logger.log(`BucketList ${bucketListId} fully converted to bookings`);
        }
    }

    // ─────────────────────────────────────────
    // Delete
    // ─────────────────────────────────────────

    async deleteBucketList(bucketListId: string, userId: string) {
        const bucketList = await this.assertBucketListOwner(bucketListId, userId);

        if (bucketList.status === BucketListStatus.CONVERTED_TO_BOOKING) {
            throw new BadRequestException(
                'Cannot delete a bucket list that has been converted to bookings',
            );
        }

        // Cascade delete handled by schema onDelete: Cascade on BucketListItem
        await this.databaseService.bucketList.delete({
            where: { id: bucketListId },
        });

        return { message: 'Bucket list deleted successfully' };
    }
}