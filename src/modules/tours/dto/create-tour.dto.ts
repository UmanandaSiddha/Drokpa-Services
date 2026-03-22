import {
    ArrayUnique,
    IsArray,
    IsBoolean,
    IsEnum,
    IsInt,
    IsOptional,
    IsString,
    IsUUID,
    Min,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TourType } from 'generated/prisma/enums';

export class SuggestedTrekConfigDto {
    @IsUUID()
    trekId: string;

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    rules?: string[];

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    conditions?: string[];

    @IsOptional()
    @IsInt()
    @Min(0)
    displayOrder?: number;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

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

    @IsOptional()
    @IsString()
    maxAltitude?: string;

    @IsOptional()
    @IsString()
    distance?: string;

    @IsOptional()
    @IsString()
    bestSeason?: string;

    @IsOptional()
    @IsBoolean()
    customDateRequestEnabled?: boolean;

    @IsOptional()
    @IsInt()
    @Min(1)
    customDateMinParticipants?: number;

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    bookingRules?: string[];

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    bookingConditions?: string[];

    @IsOptional()
    @IsArray()
    @ArrayUnique((item: SuggestedTrekConfigDto) => item.trekId)
    @ValidateNested({ each: true })
    @Type(() => SuggestedTrekConfigDto)
    suggestedTreks?: SuggestedTrekConfigDto[];

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