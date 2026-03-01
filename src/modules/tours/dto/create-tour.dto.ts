import {
    IsArray, IsBoolean, IsEnum, IsInt,
    IsOptional, IsString, Min,
} from 'class-validator';
import { TourType } from 'generated/prisma/enums';

export class CreateTourDto {
    @IsString()
    title: string;

    @IsString()
    description: string;

    @IsEnum(TourType)
    @IsOptional()
    type?: TourType;

    @IsInt()
    @Min(1)
    price: number;

    @IsInt()
    @Min(1)
    duration: number;

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    imageUrls?: string[];

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    tags?: string[];

    @IsOptional()
    @IsInt()
    @Min(1)
    maxCapacity?: number;

    @IsOptional()
    @IsString()
    addressId?: string;

    @IsOptional()
    @IsString()
    providerId?: string;

    @IsOptional()
    @IsString()
    guideId?: string;

    @IsOptional()
    @IsString()
    about?: string;

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    included?: string[];

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    notIncluded?: string[];

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    highlights?: string[];

    @IsOptional()
    @IsString()
    brochure?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    @IsInt()
    @Min(0)
    discount?: number;
}