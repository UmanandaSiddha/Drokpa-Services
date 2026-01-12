import {
    IsDateString,
    IsInt,
    IsString,
    Min,
    IsNotEmpty,
} from 'class-validator';

export class CreateHomestayBookingDto {
    @IsString()
    @IsNotEmpty()
    roomId: string;

    @IsDateString()
    checkIn: string;

    @IsDateString()
    checkOut: string;

    @IsInt()
    @Min(1)
    rooms: number;

    @IsInt()
    @Min(1)
    guestCount: number;
}