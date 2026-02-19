// add-item.dto.ts
import {
    IsDateString, IsEnum, IsInt, IsNotEmpty,
    IsObject, IsOptional, IsUUID, Min, ValidateIf,
} from 'class-validator';
import { ProviderType } from 'generated/prisma/enums';

export class AddBucketListItemDto {
    @IsEnum(ProviderType)
    productType: ProviderType;

    @IsUUID()
    @IsNotEmpty()
    @ValidateIf(obj => obj.productType === ProviderType.TOUR_VENDOR)
    tourId?: string;

    @IsUUID()
    @IsNotEmpty()
    @ValidateIf(obj => obj.productType === ProviderType.HOMESTAY_HOST)
    homestayId?: string;

    @IsUUID()
    @IsNotEmpty()
    @ValidateIf(obj => obj.productType === ProviderType.VEHICLE_PARTNER)
    vehicleId?: string;

    @IsUUID()
    @IsNotEmpty()
    @ValidateIf(obj => obj.productType === ProviderType.LOCAL_GUIDE)
    guideId?: string;

    @IsInt()
    @Min(1)
    quantity: number;

    @IsOptional()
    @IsDateString()
    startDate?: string;

    @IsOptional()
    @IsDateString()
    endDate?: string;

    @IsOptional()
    @IsObject()
    metadata?: Record<string, any>;
}