import { IsString, IsArray, IsInt, Min, IsBoolean, IsOptional, IsNotEmpty, IsNumberString } from 'class-validator';

export class CreateLocalGuideDto {
    @IsString()
    @IsOptional()
    bio?: string;

    @IsArray()
    @IsString({ each: true })
    languages: string[];

    @IsArray()
    @IsString({ each: true })
    specialties: string[];

    @IsInt()
    @Min(1)
    basePricePerDay: number;

    @IsArray()
    @IsString({ each: true })
    imageUrls: string[];

    @IsString()
    @IsOptional()
    addressId?: string;
}
