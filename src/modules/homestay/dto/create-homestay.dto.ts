import { IsArray, IsBoolean, IsNumber, IsString } from 'class-validator';

export class CreateHomestayDto {
    @IsString()
    name: string;

    @IsString()
    description: string;

    @IsNumber()
    latitude: number;

    @IsNumber()
    longitude: number;

    @IsString()
    address: string;

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
    isActive?: boolean;
}