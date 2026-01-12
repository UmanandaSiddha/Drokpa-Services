import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from 'src/services/database/database.service';
import { CreateBucketListDto } from './dto/create-bucketlist.dto';
import { AddBucketListItemDto } from './dto/add-item.dto';
import { BucketListStatus, ProductType } from 'generated/prisma/enums';

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

        // Verify product exists
        await this.verifyProductExists(dto.productType, dto.productId);

        return this.databaseService.bucketListItem.create({
            data: {
                bucketListId,
                productType: dto.productType,
                productId: dto.productId,
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

        if (dto.productId && dto.productType) {
            await this.verifyProductExists(dto.productType, dto.productId);
        }

        return this.databaseService.bucketListItem.update({
            where: { id: itemId },
            data: {
                ...(dto.productType && { productType: dto.productType }),
                ...(dto.productId && { productId: dto.productId }),
                ...(dto.quantity && { quantity: dto.quantity }),
                ...(dto.startDate && { startDate: new Date(dto.startDate) }),
                ...(dto.endDate && { endDate: new Date(dto.endDate) }),
                ...(dto.metadata && { metadata: dto.metadata }),
            },
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

    private async verifyProductExists(productType: ProductType, productId: string) {
        switch (productType) {
            case ProductType.TOUR:
                const tour = await this.databaseService.tour.findUnique({
                    where: { id: productId },
                });
                if (!tour || !tour.isActive) {
                    throw new BadRequestException('Tour not found or not active');
                }
                break;

            case ProductType.HOMESTAY:
                const homestay = await this.databaseService.homestay.findUnique({
                    where: { id: productId },
                });
                if (!homestay || !homestay.isActive) {
                    throw new BadRequestException('Homestay not found or not active');
                }
                break;

            case ProductType.VEHICLE:
                const vehicle = await this.databaseService.vehicle.findUnique({
                    where: { id: productId },
                });
                if (!vehicle || !vehicle.isActive) {
                    throw new BadRequestException('Vehicle not found or not active');
                }
                break;

            case ProductType.LOCAL_GUIDE:
                const guide = await this.databaseService.localGuide.findUnique({
                    where: { id: productId },
                });
                if (!guide || !guide.isActive) {
                    throw new BadRequestException('Guide not found or not active');
                }
                break;

            default:
                throw new BadRequestException('Invalid product type');
        }
    }
}
