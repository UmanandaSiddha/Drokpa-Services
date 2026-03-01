import {
    IsArray,
    IsBoolean,
    IsEnum,
    IsInt,
    IsOptional,
    IsString,
    Min,
} from 'class-validator';
import { BookingCriteria } from 'generated/prisma/enums';

export class CreateHomestayRoomDto {
    @IsString()
    name: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsInt()
    @Min(1)
    capacity: number;

    @IsInt()
    @Min(1)
    basePrice: number;

    @IsInt()
    @Min(1)
    totalRooms: number;

    @IsInt()
    @Min(0)
    @IsOptional()
    discount?: number;

    @IsEnum(BookingCriteria)
    @IsOptional()
    bookingCriteria?: BookingCriteria;

    @IsArray()
    @IsOptional()
    amenities?: string[];

    @IsArray()
    @IsOptional()
    imageUrls?: string[];

    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}