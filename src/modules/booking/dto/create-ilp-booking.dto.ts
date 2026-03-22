import {
    ArrayMinSize,
    IsArray,
    IsDateString,
    IsOptional,
    IsString,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BookingGuestDto } from './booking-guest.dto';

export class CreateIlpBookingDto {
    @IsDateString()
    startDate: string;

    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => BookingGuestDto)
    guests: BookingGuestDto[];

    @IsOptional()
    @IsString()
    ilpProductId?: string;

    @IsOptional()
    @IsString()
    couponCode?: string;

    @IsOptional()
    @IsString()
    specialRequests?: string;
}
