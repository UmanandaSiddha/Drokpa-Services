import {
    IsArray, IsBoolean, IsInt,
    IsOptional, IsString, IsUUID, Min,
} from 'class-validator';

export class CreateLocalGuideDto {
    @IsOptional()
    @IsString()
    bio?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    languages?: string[];

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    specialties?: string[];

    @IsInt()
    @Min(1)
    basePricePerDay: number;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    imageUrls?: string[];

    @IsOptional()
    @IsUUID()
    addressId?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}