import {
    IsArray,
    IsDateString,
    IsInt,
    IsString,
    Min,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BookingGuestDto } from './booking-guest.dto';

export class CreateHomestayBookingDto {
    @IsString()
    roomId: string;

    @IsDateString()
    checkIn: string;

    @IsDateString()
    checkOut: string;

    @IsInt()
    @Min(1)
    rooms: number;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => BookingGuestDto)
    guests: BookingGuestDto[];
}