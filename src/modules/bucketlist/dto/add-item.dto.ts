import { IsString, IsDateString, IsInt, Min, IsOptional, IsObject } from 'class-validator';
import { ProductType } from 'generated/prisma/enums';

export class AddBucketListItemDto {
    @IsString()
    productType: ProductType;

    @IsString()
    productId: string;

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
