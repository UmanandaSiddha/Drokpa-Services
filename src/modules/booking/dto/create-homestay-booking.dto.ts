import {
    IsDateString, IsInt, IsOptional,
    IsString, IsUUID, Min,
} from 'class-validator';

export class CreateHomestayBookingDto {
    @IsUUID()
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
    guests: number;

    @IsOptional()
    @IsString()
    specialRequests?: string;
}