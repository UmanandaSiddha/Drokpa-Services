import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateBookingFromCustomDateRequestDto {
    @IsOptional()
    @IsDateString()
    startDate?: string;

    @IsOptional()
    @IsDateString()
    endDate?: string;

    @IsOptional()
    @IsInt()
    @Min(5)
    paymentWindowMinutes?: number;

    @IsOptional()
    @IsString()
    adminNote?: string;
}
