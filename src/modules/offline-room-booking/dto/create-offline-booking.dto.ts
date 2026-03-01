import { IsString, IsDateString, IsInt, IsOptional, IsPositive, Min } from 'class-validator';

export class CreateOfflineBookingDto {
    @IsString()
    guestName: string;

    @IsDateString()
    checkIn: string; // ISO 8601 format

    @IsDateString()
    checkOut: string; // ISO 8601 format

    @IsInt()
    @IsPositive()
    @Min(1)
    rooms: number;

    @IsInt()
    @IsPositive()
    @Min(1)
    noOfGuests: number;

    @IsOptional()
    @IsString()
    notes?: string;
}
