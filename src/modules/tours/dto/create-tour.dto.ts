import { IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString } from 'class-validator';

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

    @IsNumber()
    latitude: number;

    @IsNumber()
    longitude: number;

    @IsString()
    address: string;

    @IsOptional()
    @IsString()
    about?: string;

    @IsArray()
    included: string[];

    @IsArray()
    notIncluded: string[];

    @IsArray()
    highlights: string[];

    @IsBoolean()
    isActive?: boolean;
}