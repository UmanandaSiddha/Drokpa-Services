// create-guide-booking.dto.ts
import { IsDateString, IsInt, IsUUID, Min } from 'class-validator';

export class CreateGuideBookingDto {
    @IsUUID()
    guideId: string;

    @IsDateString()
    startDate: string;

    @IsDateString()
    endDate: string;

    @IsInt()
    @Min(1)
    quantity: number;
}