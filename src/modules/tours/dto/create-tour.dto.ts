import { IsArray, IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateTourDto {
    @IsString()
    title: string;

    @IsString()
    description: string;

    @IsInt()
    price: number;

    @IsInt()
    duration: number;

    @IsArray()
    imageUrls: string[];

    @IsArray()
    tags: string[];

    @IsOptional()
    @IsInt()
    maxCapacity?: number;

    @IsString()
    @IsOptional()
    addressId?: string;

    @IsOptional()
    @IsString()
    about?: string;

    @IsArray()
    included: string[];

    @IsArray()
    notIncluded: string[];

    @IsArray()
    highlights: string[];

    @IsString()
    @IsOptional()
    brochure?: string;

    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}