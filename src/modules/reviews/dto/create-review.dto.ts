import { IsString, IsInt, Min, Max, IsOptional, IsEnum, IsNotEmpty } from 'class-validator';
import { ReviewTarget } from 'generated/prisma/enums';

export class CreateReviewDto {
    @IsEnum(ReviewTarget)
    targetType: ReviewTarget;

    @IsString()
    @IsNotEmpty()
    targetId: string;

    @IsInt()
    @Min(1)
    @Max(5)
    rating: number;

    @IsString()
    @IsOptional()
    comment?: string;

    @IsString()
    @IsOptional()
    bookingId?: string;
}
