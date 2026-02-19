import {
    IsArray, IsNotEmpty, IsNumber,
    IsOptional, IsString, IsUUID,
    Max, Min,
} from 'class-validator';

export class CreatePOIDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    specialty?: string[];

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    imageUrls?: string[];

    @IsNumber()
    @Min(-90)
    @Max(90)
    latitude: number;

    @IsNumber()
    @Min(-180)
    @Max(180)
    longitude: number;

    @IsOptional()
    @IsUUID()
    addressId?: string;
}