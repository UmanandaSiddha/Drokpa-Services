import { IsInt, IsString, Min } from 'class-validator';

export class CreateHomestayRoomDto {
    @IsString()
    name: string;

    @IsInt()
    @Min(1)
    capacity: number;

    @IsInt()
    @Min(1)
    basePrice: number;

    @IsInt()
    @Min(1)
    totalRooms: number;
}