import { IsInt, IsObject, IsString } from 'class-validator';

export class AddItineraryDto {
    @IsInt()
    dayNumber: number;

    @IsString()
    title: string;

    @IsObject()
    details: Record<string, any>;
}