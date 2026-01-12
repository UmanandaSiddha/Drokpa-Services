import { IsString, IsArray, IsNumber, IsOptional, IsNotEmpty } from 'class-validator';

export class CreatePOIDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsArray()
    @IsString({ each: true })
    specialty: string[];

    @IsArray()
    @IsString({ each: true })
    imageUrls: string[];

    @IsNumber()
    latitude: number;

    @IsNumber()
    longitude: number;

    @IsString()
    @IsOptional()
    addressId?: string;
}
