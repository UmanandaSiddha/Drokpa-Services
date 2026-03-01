import { IsArray, IsBoolean, IsOptional, IsString, IsInt, IsEnum } from 'class-validator';
import { BookingCriteria } from 'generated/prisma/enums';

export class CreateHomestayDto {
    @IsString()
    name: string;

    @IsString()
    description: string;

    @IsArray()
    @IsOptional()
    houseRules?: string[];

    @IsArray()
    @IsOptional()
    safetyNSecurity?: string[];

    @IsArray()
    @IsOptional()
    imageUrls?: string[];

    @IsInt()
    @IsOptional()
    displayPrice?: number;

    @IsEnum(BookingCriteria)
    @IsOptional()
    bookingCriteria?: BookingCriteria;

    @IsString()
    email: string;

    @IsString()
    phoneNumber: string;

    @IsString()
    @IsOptional()
    addressId?: string;

    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}