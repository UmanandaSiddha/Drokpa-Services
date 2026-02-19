import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class RejectBookingDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(500) // prevent abuse — rejection reasons should be concise
    reason: string;
}