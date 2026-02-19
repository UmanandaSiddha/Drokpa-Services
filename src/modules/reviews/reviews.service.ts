import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from 'src/services/database/database.service';
import { PrismaApiFeatures, QueryString } from 'src/utils/apiFeatures';
import { CreateReviewDto } from './dto/create-review.dto';
import { BookingStatus, ProviderType } from 'generated/prisma/enums';
import { Prisma } from 'generated/prisma/client';

// Reusable user select for review responses
const REVIEW_USER_SELECT = {
    id: true,
    firstName: true,
    lastName: true,
    avatarUrl: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class ReviewsService {
    constructor(private readonly databaseService: DatabaseService) { }

    // ─────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────

    /**
     * Strict parsing — only TOUR and HOMESTAY are reviewable.
     * Raw ProviderType values are not accepted to prevent reviews
     * on non-reviewable product types.
     */
    private parseTargetType(value: string): ProviderType {
        const map: Record<string, ProviderType> = {
            TOUR: ProviderType.TOUR_VENDOR,
            HOMESTAY: ProviderType.HOMESTAY_HOST,
        };
        const result = map[value.toUpperCase()];
        if (!result) {
            throw new BadRequestException('targetType must be TOUR or HOMESTAY');
        }
        return result;
    }

    private getTargetFilter(
        targetType: ProviderType,
        targetId: string,
    ): { tourId?: string; homestayId?: string } {
        if (targetType === ProviderType.TOUR_VENDOR) return { tourId: targetId };
        if (targetType === ProviderType.HOMESTAY_HOST) return { homestayId: targetId };
        throw new BadRequestException('Reviews are only supported for tours and homestays');
    }

    private async validateTargetExists(
        targetType: ProviderType,
        targetId: string,
    ): Promise<void> {
        if (targetType === ProviderType.TOUR_VENDOR) {
            const tour = await this.databaseService.tour.findUnique({
                where: { id: targetId },
                select: { id: true },
            });
            if (!tour) throw new NotFoundException('Tour not found');
        } else {
            const homestay = await this.databaseService.homestay.findUnique({
                where: { id: targetId },
                select: { id: true },
            });
            if (!homestay) throw new NotFoundException('Homestay not found');
        }
    }

    // ─────────────────────────────────────────
    // Create
    // ─────────────────────────────────────────

    async createReview(userId: string, dto: CreateReviewDto) {
        const targetType = this.parseTargetType(String(dto.targetType));
        const targetFilter = this.getTargetFilter(targetType, dto.targetId);

        await this.validateTargetExists(targetType, dto.targetId);

        // Verify booking belongs to user and is completed
        if (dto.bookingId) {
            const booking = await this.databaseService.booking.findUnique({
                where: { id: dto.bookingId },
                select: { userId: true, status: true },
            });
            if (!booking || booking.userId !== userId) {
                throw new ForbiddenException('Invalid booking');
            }
            if (booking.status !== BookingStatus.COMPLETED) {
                throw new BadRequestException(
                    'You can only review after a completed booking',
                );
            }
        }

        // One review per user per product
        const existing = await this.databaseService.review.findFirst({
            where: { userId, targetType, ...targetFilter },
            select: { id: true },
        });
        if (existing) {
            throw new BadRequestException('You have already reviewed this product');
        }

        const review = await this.databaseService.review.create({
            data: {
                userId,
                targetType,
                rating: dto.rating,
                comment: dto.comment,
                bookingId: dto.bookingId,
                ...targetFilter,
            },
            include: { user: { select: REVIEW_USER_SELECT } },
        });

        // Update rating aggregate on parent product
        await this.updateProductRating(targetType, dto.targetId);

        return review;
    }

    // ─────────────────────────────────────────
    // List
    // ─────────────────────────────────────────

    async getReviews(targetType: string, targetId: string, queryStr: QueryString) {
        const resolvedType = this.parseTargetType(targetType);
        const targetFilter = this.getTargetFilter(resolvedType, targetId);

        const features = new PrismaApiFeatures<
            Prisma.ReviewWhereInput,
            Prisma.ReviewInclude,
            Prisma.ReviewOrderByWithRelationInput,
            typeof this.databaseService.review
        >(this.databaseService.review, queryStr)
            .where({ targetType: resolvedType, ...targetFilter })
            .sort({ createdAt: 'desc' } as Prisma.ReviewOrderByWithRelationInput)
            .include({ user: { select: REVIEW_USER_SELECT } })
            .pagination(20);

        const { results, totalCount } = await features.execute();
        const page = Number(queryStr.page) || 1;
        const limit = Number(queryStr.limit) || 20;

        return {
            data: results,
            meta: { total: totalCount, page, limit, totalPages: Math.ceil(totalCount / limit) },
        };
    }

    // ─────────────────────────────────────────
    // Get single
    // ─────────────────────────────────────────

    async getReview(id: string) {
        const review = await this.databaseService.review.findUnique({
            where: { id },
            include: { user: { select: REVIEW_USER_SELECT } },
        });
        if (!review) throw new NotFoundException('Review not found');
        return review;
    }

    // ─────────────────────────────────────────
    // Get my reviews
    // ─────────────────────────────────────────

    async getMyReviews(userId: string) {
        return this.databaseService.review.findMany({
            where: { userId },
            include: {
                booking: { select: { id: true, status: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    // ─────────────────────────────────────────
    // Update
    // ─────────────────────────────────────────

    async updateReview(id: string, userId: string, dto: Partial<CreateReviewDto>) {
        const review = await this.databaseService.review.findUnique({
            where: { id },
            select: { id: true, userId: true, targetType: true, tourId: true, homestayId: true },
        });
        if (!review) throw new NotFoundException('Review not found');
        if (review.userId !== userId) {
            throw new ForbiddenException('You do not have permission to update this review');
        }

        // Prevent changing review target — the product and booking are fixed
        if (dto.targetId || dto.targetType || dto.bookingId) {
            throw new BadRequestException('Cannot change review target or booking');
        }

        const data: Prisma.ReviewUpdateInput = {
            ...(dto.rating !== undefined && { rating: dto.rating }),
            ...(dto.comment !== undefined && { comment: dto.comment }),
        };

        const updated = await this.databaseService.review.update({
            where: { id },
            data,
            include: { user: { select: REVIEW_USER_SELECT } },
        });

        // Re-aggregate rating after update
        const targetId = (review.tourId ?? review.homestayId)!;
        await this.updateProductRating(review.targetType as ProviderType, targetId);

        return updated;
    }

    // ─────────────────────────────────────────
    // Delete
    // ─────────────────────────────────────────

    async deleteReview(id: string, userId: string) {
        const review = await this.databaseService.review.findUnique({
            where: { id },
            select: { id: true, userId: true, targetType: true, tourId: true, homestayId: true },
        });
        if (!review) throw new NotFoundException('Review not found');
        if (review.userId !== userId) {
            throw new ForbiddenException('You do not have permission to delete this review');
        }

        await this.databaseService.review.delete({ where: { id } });

        // Re-aggregate rating after deletion
        const targetId = (review.tourId ?? review.homestayId)!;
        await this.updateProductRating(review.targetType as ProviderType, targetId);

        return { message: 'Review deleted successfully' };
    }

    // ─────────────────────────────────────────
    // Rating aggregation
    // ─────────────────────────────────────────

    /**
     * Recomputes and persists the average rating and total review count
     * on the parent product (Tour or Homestay) after any review mutation.
     */
    private async updateProductRating(
        targetType: ProviderType,
        targetId: string,
    ): Promise<void> {
        const filter =
            targetType === ProviderType.TOUR_VENDOR
                ? { tourId: targetId }
                : { homestayId: targetId };

        const aggregate = await this.databaseService.review.aggregate({
            where: filter,
            _avg: { rating: true },
            _count: { id: true },
        });

        const rating = aggregate._avg.rating ?? 0;
        const totalReviews = aggregate._count.id;

        if (targetType === ProviderType.TOUR_VENDOR) {
            await this.databaseService.tour.update({
                where: { id: targetId },
                data: { rating, totalReviews },
            });
        } else {
            await this.databaseService.homestay.update({
                where: { id: targetId },
                data: { rating, totalReviews },
            });
        }
    }
}