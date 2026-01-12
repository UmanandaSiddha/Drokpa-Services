import { IsString, IsDateString, IsInt, Min, IsNotEmpty } from 'class-validator';

export class CreateVehicleBookingDto {
    @IsString()
    @IsNotEmpty()
    vehicleId: string;

    @IsDateString()
    startDate: string;

    @IsDateString()
    endDate: string;

    @IsInt()
    @Min(1)
    quantity: number;
}
