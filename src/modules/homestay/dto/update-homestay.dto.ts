import { IsArray, IsBoolean, IsOptional, IsString, IsInt, IsEnum } from 'class-validator';
import { BookingCriteria } from 'generated/prisma/enums';

// Update DTO intentionally mirrors CreateHomestayDto but adds providerId.
// providerId is enforced as admin-only in the service layer.
export class UpdateHomestayDto {
    @IsString()
    @IsOptional()
    name?: string;

    @IsString()
    @IsOptional()
    description?: string;

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
    @IsOptional()
    email?: string;

    @IsString()
    @IsOptional()
    phoneNumber?: string;

    @IsString()
    @IsOptional()
    addressId?: string;

    @IsBoolean()
    @IsOptional()
    isActive?: boolean;

    @IsString()
    @IsOptional()
    providerId?: string;
}
