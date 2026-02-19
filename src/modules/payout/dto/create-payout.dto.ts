import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class CreatePayoutDto {
    @IsUUID()
    bookingItemId: string;

    @IsUUID()
    providerId: string;

    @IsNumber()
    @Min(0)
    amount: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    platformFee?: number;

    @IsDateString()
    periodStart: string;

    @IsDateString()
    periodEnd: string;
}