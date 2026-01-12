import { IsString, IsNotEmpty, IsOptional, IsNumber, Min } from 'class-validator';

export class CreatePaymentDto {
    @IsString()
    @IsNotEmpty()
    bookingId: string;

    @IsNumber()
    @Min(1)
    amount: number;

    @IsString()
    @IsOptional()
    currency?: string;

    @IsString()
    @IsOptional()
    notes?: string;
}
