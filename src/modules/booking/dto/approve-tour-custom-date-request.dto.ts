import { IsDateString, IsOptional, IsString } from 'class-validator';

export class ApproveTourCustomDateRequestDto {
    @IsOptional()
    @IsDateString()
    approvedStartDate?: string;

    @IsOptional()
    @IsDateString()
    approvedEndDate?: string;

    @IsOptional()
    @IsString()
    adminNote?: string;
}
