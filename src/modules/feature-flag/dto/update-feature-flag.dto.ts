import { IsBoolean, IsString, IsOptional } from 'class-validator';

export class UpdateFeatureFlagDto {
    @IsBoolean()
    enabled: boolean;

    @IsString()
    @IsOptional()
    message?: string;
}
