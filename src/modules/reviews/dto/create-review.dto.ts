import {
    IsEnum, IsInt, IsOptional,
    IsString, IsUUID, Max, Min,
} from 'class-validator';

export enum ReviewTargetType {
    TOUR = 'TOUR',
    HOMESTAY = 'HOMESTAY',
}

export class CreateReviewDto {
    @IsEnum(ReviewTargetType)
    targetType: ReviewTargetType;

    @IsUUID()
    targetId: string;

    @IsInt()
    @Min(1)
    @Max(5)
    rating: number;

    @IsOptional()
    @IsString()
    comment?: string;

    @IsOptional()
    @IsUUID()
    bookingId?: string;
}