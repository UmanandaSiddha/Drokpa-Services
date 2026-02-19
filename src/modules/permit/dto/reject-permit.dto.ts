import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectPermitDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(500)
    reason: string;
}