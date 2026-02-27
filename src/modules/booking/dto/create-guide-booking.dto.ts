// create-guide-booking.dto.ts
import { IsDateString, IsInt, IsUUID, Min, IsOptional, IsString } from 'class-validator';

export class CreateGuideBookingDto {
    @IsUUID()
    guideId: string;

    @IsDateString()
    startDate: string;

    @IsDateString()
    endDate: string;

    @IsInt()
    @Min(1)
    quantity: number;

    /** Optional promo / coupon code to apply at booking time */
    @IsOptional()
    @IsString()
    couponCode?: string;
}