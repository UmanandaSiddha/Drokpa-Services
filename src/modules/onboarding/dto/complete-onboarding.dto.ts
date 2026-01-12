import { IsString, IsObject, IsOptional, IsNotEmpty } from 'class-validator';

export class CompleteOnboardingDto {
    @IsString()
    @IsNotEmpty()
    token: string;

    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    contactNumber: string;

    @IsObject()
    @IsOptional()
    metadata?: Record<string, any>;
}
