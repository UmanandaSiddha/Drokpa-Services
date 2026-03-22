import { IsString, IsArray, IsInt, IsOptional, IsBoolean, Min } from 'class-validator';

export class AddSuggestedTrekDto {
    @IsString()
    trekId: string;

    @IsArray()
    @IsOptional()
    rules?: string[];

    @IsArray()
    @IsOptional()
    conditions?: string[];

    @IsInt()
    @Min(0)
    @IsOptional()
    displayOrder?: number;

    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}
