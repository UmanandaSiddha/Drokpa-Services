import { IsString, IsNotEmpty, IsOptional, IsNumber, Min } from 'class-validator';

export class CreateRefundDto {
    @IsString()
    @IsNotEmpty()
    paymentId: string;

    @IsNumber()
    @Min(1)
    @IsOptional()
    amount?: number;

    @IsString()
    @IsOptional()
    reason?: string;
}
