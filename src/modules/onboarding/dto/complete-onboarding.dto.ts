import { IsString, IsObject, IsOptional } from 'class-validator';

export class CompleteOnboardingDto {
    @IsString()
    token: string;

    @IsObject()
    @IsOptional()
    metadata?: Record<string, any>;
}
