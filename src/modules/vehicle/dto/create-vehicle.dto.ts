import {
    IsArray, IsBoolean, IsEnum, IsInt,
    IsNotEmpty, IsOptional, IsString, IsUUID, Min,
} from 'class-validator';
import { VehicleType, VehicleBookingMode } from 'generated/prisma/enums';

export class CreateVehicleDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsEnum(VehicleType)
    type: VehicleType;

    @IsOptional()
    @IsString()
    brand?: string;

    @IsOptional()
    @IsString()
    model?: string;

    @IsString()
    @IsNotEmpty()
    registrationNo: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    imageUrls?: string[];

    @IsInt()
    @Min(1)
    basePricePerDay: number;

    @IsOptional()
    @IsArray()
    @IsEnum(VehicleBookingMode, { each: true })
    bookingMode?: VehicleBookingMode[];

    @IsOptional()
    @IsUUID()
    addressId?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}