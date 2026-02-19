import { IsDateString, IsInt, IsUUID, Min } from 'class-validator';

export class CreateVehicleBookingDto {
    @IsUUID()
    vehicleId: string;

    @IsDateString()
    startDate: string;

    @IsDateString()
    endDate: string;

    @IsInt()
    @Min(1)
    quantity: number;
}