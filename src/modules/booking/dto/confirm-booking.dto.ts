import { IsString, IsOptional } from 'class-validator';

export class ConfirmBookingDto {
    @IsString()
    @IsOptional()
    notes?: string;
}
