import {
    IsArray,
    IsDateString,
    IsString,
    ValidateNested,
    ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BookingGuestDto } from './booking-guest.dto';

export class CreateTourBookingDto {
    @IsString()
    tourId: string;

    @IsDateString()
    startDate: string;

    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => BookingGuestDto)
    guests: BookingGuestDto[];
}