import { IsString, IsArray, IsOptional } from 'class-validator';

export class CreateMemoryDto {
    @IsString()
    title: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsArray()
    @IsString({ each: true })
    imageUrls: string[];
}
