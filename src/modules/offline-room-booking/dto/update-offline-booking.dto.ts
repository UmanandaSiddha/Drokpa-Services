import { IsString, IsDateString, IsInt, IsOptional, IsPositive, Min } from 'class-validator';

export class UpdateOfflineBookingDto {
    @IsOptional()
    @IsString()
    guestName?: string;

    @IsOptional()
    @IsDateString()
    checkIn?: string; // ISO 8601 format

    @IsOptional()
    @IsDateString()
    checkOut?: string; // ISO 8601 format

    @IsOptional()
    @IsInt()
    @IsPositive()
    @Min(1)
    rooms?: number;

    @IsOptional()
    @IsInt()
    @IsPositive()
    @Min(1)
    noOfGuests?: number;

    @IsOptional()
    @IsString()
    notes?: string;
}
