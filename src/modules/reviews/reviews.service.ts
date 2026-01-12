import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from 'src/services/database/database.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
    constructor(
        private readonly databaseService: DatabaseService,
    ) { }

    async createReview(userId: string, dto: CreateReviewDto) {
        // Check if review already exists
        const existing = await this.databaseService.review.findUnique({
            where: {
                userId_targetType_targetId: {
                    userId,
                    targetType: dto.targetType,
                    targetId: dto.targetId,
                },
            },
        });

        if (existing) {
            throw new BadRequestException('Review already exists for this product');
        }

        return this.databaseService.review.create({
            data: {
                userId,
                ...dto,
            },
        });
    }

    async getReviews(targetType: string, targetId: string) {
        return this.databaseService.review.findMany({
            where: {
                targetType: targetType as any,
                targetId,
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

        return this.databaseService.review.update({
            where: { id },
            data: dto,
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
