import { IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class AddItineraryDto {
    @IsInt()
    @Min(1)
    dayNumber: number;

    @IsString()
    title: string;

    @IsOptional()
    @IsObject()
    details?: Record<string, any>;
}