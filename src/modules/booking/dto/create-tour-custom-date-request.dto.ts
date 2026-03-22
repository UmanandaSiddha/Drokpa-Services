import {
    ArrayMinSize,
    ArrayUnique,
    IsArray,
    IsDateString,
    IsOptional,
    IsString,
    IsUUID,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BookingGuestDto } from './booking-guest.dto';

export class CreateTourCustomDateRequestDto {
    @IsUUID()
    tourId: string;

    @IsDateString()
    requestedStartDate: string;

    @IsOptional()
    @IsDateString()
    requestedEndDate?: string;

    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => BookingGuestDto)
    guests: BookingGuestDto[];

    @IsOptional()
    @IsArray()
    @ArrayUnique()
    @IsUUID('4', { each: true })
    addOnTrekIds?: string[];

    @IsOptional()
    @IsString()
    couponCode?: string;

    @IsOptional()
    @IsString()
    specialRequests?: string;
}
