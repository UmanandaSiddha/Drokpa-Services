import {
    Controller, Post, Get, Patch, Delete,
    Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { AuthGuard, getUser } from 'src/modules/auth/guards/auth.guard';
import { QueryString } from 'src/utils/apiFeatures';

@Controller('review')
export class ReviewsController {
    constructor(private readonly reviewsService: ReviewsService) { }

    // ── Authenticated write endpoints ─────────

    @Post()
    @UseGuards(AuthGuard)
    createReview(
        @Body() dto: CreateReviewDto,
        @getUser('id') userId: string,
    ) {
        return this.reviewsService.createReview(userId, dto);
    }

    @Patch(':id')
    @UseGuards(AuthGuard)
    updateReview(
        @Param('id') id: string,
        @Body() dto: Partial<CreateReviewDto>,
        @getUser('id') userId: string,
    ) {
        return this.reviewsService.updateReview(id, userId, dto);
    }

    @Delete(':id')
    @UseGuards(AuthGuard)
    deleteReview(
        @Param('id') id: string,
        @getUser('id') userId: string,
    ) {
        return this.reviewsService.deleteReview(id, userId);
    }

    // ── Authenticated read endpoints ──────────

    // Static routes above param routes to prevent collision
    @Get('my-reviews')
    @UseGuards(AuthGuard)
    getMyReviews(@getUser('id') userId: string) {
        return this.reviewsService.getMyReviews(userId);
    }

    // ── Public read endpoints ─────────────────

    // GET /review/TOUR/some-tour-id
    // GET /review/HOMESTAY/some-homestay-id
    @Get(':targetType/:targetId')
    getReviews(
        @Param('targetType') targetType: string,
        @Param('targetId') targetId: string,
        @Query() query: QueryString,
    ) {
        return this.reviewsService.getReviews(targetType, targetId, query);
    }

    @Get(':id')
    getReview(@Param('id') id: string) {
        return this.reviewsService.getReview(id);
    }
}