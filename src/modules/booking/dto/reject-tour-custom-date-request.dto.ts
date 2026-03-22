import { IsOptional, IsString } from 'class-validator';

export class RejectTourCustomDateRequestDto {
    @IsString()
    reason: string;

    @IsOptional()
    @IsString()
    adminNote?: string;
}
