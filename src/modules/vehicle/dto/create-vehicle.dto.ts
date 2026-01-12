import { IsString, IsArray, IsInt, Min, IsBoolean, IsOptional, IsNotEmpty } from 'class-validator';
import { VehicleType, VehicleBookingMode } from 'generated/prisma/enums';

export class CreateVehicleDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    type: VehicleType;

    @IsString()
    @IsOptional()
    brand?: string;

    @IsString()
    @IsOptional()
    model?: string;

    @IsString()
    @IsNotEmpty()
    registrationNo: string;

    @IsArray()
    @IsString({ each: true })
    imageUrls: string[];

    @IsInt()
    @Min(1)
    basePricePerDay: number;

    @IsArray()
    bookingMode: VehicleBookingMode[];

    @IsString()
    @IsOptional()
    addressId?: string;
}
