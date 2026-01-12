import { IsString, IsDateString, IsInt, Min, IsNotEmpty } from 'class-validator';

export class CreateGuideBookingDto {
    @IsString()
    @IsNotEmpty()
    guideId: string;

    @IsDateString()
    startDate: string;

    @IsDateString()
    endDate: string;

    @IsInt()
    @Min(1)
    quantity: number;
}
