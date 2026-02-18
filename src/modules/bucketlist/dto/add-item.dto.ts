import { IsString, IsDateString, IsInt, Min, IsOptional, IsObject, ValidateIf } from 'class-validator';
import { ProviderType } from 'generated/prisma/enums';

export class AddBucketListItemDto {
    @IsString()
    productType: ProviderType;

    @IsString()
    @ValidateIf((obj) => obj.productType === ProviderType.TOUR_VENDOR)
    tourId?: string;

    @IsString()
    @ValidateIf((obj) => obj.productType === ProviderType.HOMESTAY_HOST)
    homestayId?: string;

    @IsInt()
    @Min(1)
    quantity: number;

    @IsDateString()
    @IsOptional()
    startDate?: string;

    @IsDateString()
    @IsOptional()
    endDate?: string;

    @IsObject()
    @IsOptional()
    metadata?: Record<string, any>;
}
