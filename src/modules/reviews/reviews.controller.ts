import { Controller, Post, Get, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { AuthGuard, getUser } from 'src/modules/auth/guards/auth.guard';

@Controller('review')
@UseGuards(AuthGuard)
export class ReviewsController {
    constructor(private readonly reviewsService: ReviewsService) { }

    @Post()
    createReview(
        @Body() dto: CreateReviewDto,
        @getUser('id') userId: string,
    ) {
        return this.reviewsService.createReview(userId, dto);
    }

    @Get(':targetType/:targetId')
    getReviews(
        @Param('targetType') targetType: string,
        @Param('targetId') targetId: string,
    ) {
        return this.reviewsService.getReviews(targetType, targetId);
    }

    @Get('my-reviews')
    getMyReviews(@getUser('id') userId: string) {
        return this.reviewsService.getMyReviews(userId);
    }

    @Get(':id')
    getReview(@Param('id') id: string) {
        return this.reviewsService.getReview(id);
    }

    @Put(':id')
    updateReview(
        @Param('id') id: string,
        @Body() dto: Partial<CreateReviewDto>,
        @getUser('id') userId: string,
    ) {
        return this.reviewsService.updateReview(id, userId, dto);
    }

    @Delete(':id')
    deleteReview(
        @Param('id') id: string,
        @getUser('id') userId: string,
    ) {
        return this.reviewsService.deleteReview(id, userId);
    }
}
