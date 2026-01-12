import { IsString, IsNumber, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateAddressDto {
    @IsString()
    @IsOptional()
    street?: string;

    @IsString()
    @IsNotEmpty()
    city: string;

    @IsString()
    @IsNotEmpty()
    state: string;

    @IsString()
    @IsOptional()
    country?: string;

    @IsString()
    @IsOptional()
    postalCode?: string;

    @IsNumber()
    latitude: number;

    @IsNumber()
    longitude: number;
}
