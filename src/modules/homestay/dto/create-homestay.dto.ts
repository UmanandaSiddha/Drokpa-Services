import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateHomestayDto {
    @IsString()
    name: string;

    @IsString()
    description: string;

    @IsString()
    @IsOptional()
    addressId?: string;

    @IsArray()
    tags: string[];

    @IsArray()
    facilities: string[];

    @IsArray()
    imageUrls: string[];

    @IsString()
    email: string;

    @IsString()
    phoneNumber: string;

    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}