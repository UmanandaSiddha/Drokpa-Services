import { IsDateString, IsInt, IsUUID, Min, IsOptional, IsString } from 'class-validator';

export class CreateVehicleBookingDto {
    @IsUUID()
    vehicleId: string;

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