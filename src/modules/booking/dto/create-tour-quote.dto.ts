import { ArrayUnique, IsArray, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateTourQuoteDto {
    @IsUUID()
    tourId: string;

    @IsInt()
    @Min(1)
    participantCount: number;

    @IsOptional()
    @IsString()
    couponCode?: string;

    @IsOptional()
    @IsArray()
    @ArrayUnique()
    @IsUUID('4', { each: true })
    addOnTrekIds?: string[];
}
