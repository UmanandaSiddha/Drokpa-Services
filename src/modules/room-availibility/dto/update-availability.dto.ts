import { IsDateString, IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateAvailabilityDto {
    @IsDateString()
    date: string;

    @IsOptional()
    @IsInt()
    @Min(0)
    available?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    price?: number;
}