import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from 'src/services/database/database.service';
import { CreateBucketListDto } from './dto/create-bucketlist.dto';
import { AddBucketListItemDto } from './dto/add-item.dto';
import { BucketListStatus, ProviderType } from 'generated/prisma/enums';

@Injectable()
export class BucketListService {
    constructor(
        private readonly databaseService: DatabaseService,
    ) { }

    async createBucketList(userId: string, dto: CreateBucketListDto) {
        return this.databaseService.bucketList.create({
            data: {
                userId,
                tripName: dto.tripName,
                status: BucketListStatus.DRAFT,
            },
        });
    }

    async addItem(bucketListId: string, userId: string, dto: AddBucketListItemDto) {
        const bucketList = await this.databaseService.bucketList.findUnique({
            where: { id: bucketListId },
        });

        if (!bucketList) {
            throw new NotFoundException('BucketList not found');
        }

        if (bucketList.userId !== userId) {
            throw new BadRequestException('Unauthorized access');
        }

        if (bucketList.status !== BucketListStatus.DRAFT) {
            throw new BadRequestException('Cannot add items to non-draft bucketlist');
        }

        // Verify product exists and validate required field
        const { tourId, homestayId } = await this.verifyAndGetProductIds(dto.productType, dto.tourId, dto.homestayId);

        return this.databaseService.bucketListItem.create({
            data: {
                bucketListId,
                productType: dto.productType,
                tourId: tourId || null,
                homestayId: homestayId || null,
                quantity: dto.quantity,
                startDate: dto.startDate ? new Date(dto.startDate) : null,
                endDate: dto.endDate ? new Date(dto.endDate) : null,
                metadata: dto.metadata || {},
            },
        });
    }

    async updateItem(bucketListId: string, itemId: string, userId: string, dto: Partial<AddBucketListItemDto>) {
        const bucketList = await this.databaseService.bucketList.findUnique({
            where: { id: bucketListId },
        });

        if (!bucketList || bucketList.userId !== userId) {
            throw new NotFoundException('BucketList not found');
        }

        if (bucketList.status !== BucketListStatus.DRAFT) {
            throw new BadRequestException('Cannot update items in non-draft bucketlist');
        }

        const item = await this.databaseService.bucketListItem.findUnique({
            where: { id: itemId },
        });

        if (!item || item.bucketListId !== bucketListId) {
            throw new NotFoundException('Item not found');
        }

        const updateData: any = {};

        if (dto.productType) {
            updateData.productType = dto.productType;
        }

        if (dto.tourId || dto.homestayId) {
            const productType = dto.productType || item.productType;
            const { tourId, homestayId } = await this.verifyAndGetProductIds(
                productType,
                dto.tourId,
                dto.homestayId,
            );
            if (tourId) updateData.tourId = tourId;
            if (homestayId) updateData.homestayId = homestayId;
        }

        if (dto.quantity) updateData.quantity = dto.quantity;
        if (dto.startDate) updateData.startDate = new Date(dto.startDate);
        if (dto.endDate) updateData.endDate = new Date(dto.endDate);
        if (dto.metadata) updateData.metadata = dto.metadata;

        return this.databaseService.bucketListItem.update({
            where: { id: itemId },
            data: updateData,
        });
    }

    async removeItem(bucketListId: string, itemId: string, userId: string) {
        const bucketList = await this.databaseService.bucketList.findUnique({
            where: { id: bucketListId },
        });

        if (!bucketList || bucketList.userId !== userId) {
            throw new NotFoundException('BucketList not found');
        }

        if (bucketList.status !== BucketListStatus.DRAFT) {
            throw new BadRequestException('Cannot remove items from non-draft bucketlist');
        }

        const item = await this.databaseService.bucketListItem.findUnique({
            where: { id: itemId },
        });

        if (!item || item.bucketListId !== bucketListId) {
            throw new NotFoundException('Item not found');
        }

        await this.databaseService.bucketListItem.delete({
            where: { id: itemId },
        });

        return { message: 'Item removed successfully' };
    }

    async getBucketLists(userId: string, status?: BucketListStatus) {
        return this.databaseService.bucketList.findMany({
            where: {
                userId,
                ...(status && { status }),
            },
            include: {
                items: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getBucketList(bucketListId: string, userId: string) {
        const bucketList = await this.databaseService.bucketList.findUnique({
            where: { id: bucketListId },
            include: {
                items: true,
            },
        });

        if (!bucketList) {
            throw new NotFoundException('BucketList not found');
        }

        if (bucketList.userId !== userId) {
            throw new BadRequestException('Unauthorized access');
        }

        return bucketList;
    }

    async checkout(bucketListId: string, userId: string) {
        const bucketList = await this.databaseService.bucketList.findUnique({
            where: { id: bucketListId },
            include: {
                items: true,
            },
        });

        if (!bucketList || bucketList.userId !== userId) {
            throw new NotFoundException('BucketList not found');
        }

        if (bucketList.status !== BucketListStatus.DRAFT) {
            throw new BadRequestException('BucketList is not in draft status');
        }

        if (bucketList.items.length === 0) {
            throw new BadRequestException('BucketList is empty');
        }

        // Group items by product type and create bookings
        // This is a simplified version - in production, you'd want more sophisticated grouping
        const bookings = [];

        // For now, create one booking per item type group
        // In a real implementation, you might want to group by dates, locations, etc.
        for (const item of bucketList.items) {
            // This would call the appropriate booking service method
            // For now, we'll just mark the bucketlist as converted
            // The actual booking creation would be handled by the booking service
        }

        // Update bucketlist status
        await this.databaseService.bucketList.update({
            where: { id: bucketListId },
            data: {
                status: BucketListStatus.CONVERTED_TO_BOOKING,
            },
        });

        return {
            message: 'BucketList converted to bookings',
            bucketListId,
            // bookings would be returned here
        };
    }

    async deleteBucketList(bucketListId: string, userId: string) {
        const bucketList = await this.databaseService.bucketList.findUnique({
            where: { id: bucketListId },
        });

        if (!bucketList || bucketList.userId !== userId) {
            throw new NotFoundException('BucketList not found');
        }

        if (bucketList.status === BucketListStatus.CONVERTED_TO_BOOKING) {
            throw new BadRequestException('Cannot delete converted bucketlist');
        }

        await this.databaseService.bucketList.delete({
            where: { id: bucketListId },
        });

        return { message: 'BucketList deleted successfully' };
    }

    private async verifyAndGetProductIds(
        productType: ProviderType,
        tourId?: string,
        homestayId?: string,
    ): Promise<{ tourId: string | null; homestayId: string | null }> {
        switch (productType) {
            case ProviderType.TOUR_VENDOR:
                if (!tourId) {
                    throw new BadRequestException('tourId is required for TOUR_VENDOR');
                }
                const tour = await this.databaseService.tour.findUnique({
                    where: { id: tourId },
                });
                if (!tour || !tour.isActive) {
                    throw new BadRequestException('Tour not found or not active');
                }
                return { tourId, homestayId: null };

            case ProviderType.HOMESTAY_HOST:
                if (!homestayId) {
                    throw new BadRequestException('homestayId is required for HOMESTAY_HOST');
                }
                const homestay = await this.databaseService.homestay.findUnique({
                    where: { id: homestayId },
                });
                if (!homestay || !homestay.isActive) {
                    throw new BadRequestException('Homestay not found or not active');
                }
                return { tourId: null, homestayId };

            case ProviderType.VEHICLE_PARTNER:
                if (!tourId) {
                    throw new BadRequestException('tourId is required for VEHICLE_PARTNER');
                }
                const vehicle = await this.databaseService.vehicle.findUnique({
                    where: { id: tourId },
                });
                if (!vehicle || !vehicle.isActive) {
                    throw new BadRequestException('Vehicle not found or not active');
                }
                return { tourId, homestayId: null };

            case ProviderType.LOCAL_GUIDE:
                if (!tourId) {
                    throw new BadRequestException('tourId is required for LOCAL_GUIDE');
                }
                const guide = await this.databaseService.localGuide.findUnique({
                    where: { id: tourId },
                });
                if (!guide || !guide.isActive) {
                    throw new BadRequestException('Guide not found or not active');
                }
                return { tourId, homestayId: null };

            default:
                throw new BadRequestException(
                    `Invalid product type: ${productType}. Supported types: TOUR_VENDOR, HOMESTAY_HOST, VEHICLE_PARTNER, LOCAL_GUIDE`,
                );
        }
    }
}
