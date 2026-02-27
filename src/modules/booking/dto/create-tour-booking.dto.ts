import {
    IsArray, IsDateString, IsString,
    IsUUID, ValidateNested, ArrayMinSize, IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BookingGuestDto } from './booking-guest.dto';

export class CreateTourBookingDto {
    @IsUUID()
    tourId: string;

    @IsDateString()
    startDate: string;

    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => BookingGuestDto)
    guests: BookingGuestDto[];

    /** Optional promo / coupon code to apply at booking time */
    @IsOptional()
    @IsString()
    couponCode?: string;
}