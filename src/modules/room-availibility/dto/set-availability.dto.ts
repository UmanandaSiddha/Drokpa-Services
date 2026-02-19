import { IsDateString, IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class SetAvailabilityDto {
    @IsDateString()
    startDate: string;

    @IsDateString()
    endDate: string;

    @IsInt()
    @Min(0)
    available: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    price?: number;
}