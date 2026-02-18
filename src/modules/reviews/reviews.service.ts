import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from 'src/services/database/database.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ProviderType } from 'generated/prisma/enums';

@Injectable()
export class ReviewsService {
    constructor(
        private readonly databaseService: DatabaseService,
    ) { }

    private parseTargetType(value: string): ProviderType {
        const normalized = value.toUpperCase();
        if (normalized === 'TOUR') {
            return ProviderType.TOUR_VENDOR;
        }

        if (normalized === 'HOMESTAY') {
            return ProviderType.HOMESTAY_HOST;
        }

        const match = Object.values(ProviderType).find(type => type === normalized);

        if (!match) {
            throw new BadRequestException('Invalid review target type');
        }

        return match;
    }

    private getTargetFilter(targetType: ProviderType, targetId: string) {
        if (targetType === ProviderType.TOUR_VENDOR) {
            return { tourId: targetId };
        }

        if (targetType === ProviderType.HOMESTAY_HOST) {
            return { homestayId: targetId };
        }

        throw new BadRequestException('Reviews are only supported for tours and homestays');
    }

    async createReview(userId: string, dto: CreateReviewDto) {
        const targetType = this.parseTargetType(String(dto.targetType));
        const targetFilter = this.getTargetFilter(targetType, dto.targetId);

        if (targetFilter.tourId) {
            const tour = await this.databaseService.tour.findUnique({
                where: { id: targetFilter.tourId },
            });

            if (!tour) {
                throw new NotFoundException('Tour not found');
            }
        }

        if (targetFilter.homestayId) {
            const homestay = await this.databaseService.homestay.findUnique({
                where: { id: targetFilter.homestayId },
            });

            if (!homestay) {
                throw new NotFoundException('Homestay not found');
            }
        }

        // Check if review already exists
        const existing = await this.databaseService.review.findFirst({
            where: {
                userId,
                targetType,
                ...targetFilter,
            },
        });

        if (existing) {
            throw new BadRequestException('Review already exists for this product');
        }

        return this.databaseService.review.create({
            data: {
                userId,
                targetType,
                rating: dto.rating,
                comment: dto.comment,
                bookingId: dto.bookingId,
                ...targetFilter,
            },
        });
    }

    async getReviews(targetType: string, targetId: string) {
        const resolvedTargetType = this.parseTargetType(targetType);
        const targetFilter = this.getTargetFilter(resolvedTargetType, targetId);

        return this.databaseService.review.findMany({
            where: {
                targetType: resolvedTargetType,
                ...targetFilter,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        avatarUrl: true,
                    },
                },
            },
        });
    }

    async getReview(id: string) {
        const review = await this.databaseService.review.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        avatarUrl: true,
                    },
                },
            },
        });

        if (!review) {
            throw new NotFoundException('Review not found');
        }

        return review;
    }

    async updateReview(id: string, userId: string, dto: Partial<CreateReviewDto>) {
        const review = await this.databaseService.review.findUnique({
            where: { id },
        });

        if (!review) {
            throw new NotFoundException('Review not found');
        }

        if (review.userId !== userId) {
            throw new BadRequestException('Unauthorized to update this review');
        }

        if (dto.targetId || dto.targetType) {
            throw new BadRequestException('Cannot change review target');
        }

        return this.databaseService.review.update({
            where: { id },
            data: {
                rating: dto.rating,
                comment: dto.comment,
                bookingId: dto.bookingId,
            },
        });
    }

    async deleteReview(id: string, userId: string) {
        const review = await this.databaseService.review.findUnique({
            where: { id },
        });

        if (!review) {
            throw new NotFoundException('Review not found');
        }

        if (review.userId !== userId) {
            throw new BadRequestException('Unauthorized to delete this review');
        }

        await this.databaseService.review.delete({
            where: { id },
        });

        return { message: 'Review deleted successfully' };
    }

    async getMyReviews(userId: string) {
        return this.databaseService.review.findMany({
            where: { userId },
            include: {
                booking: {
                    select: {
                        id: true,
                        status: true,
                    },
                },
            },
        });
    }
}
