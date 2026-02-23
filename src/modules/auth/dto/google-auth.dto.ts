import { IsString, IsOptional } from 'class-validator';

export class GoogleAuthDto {
    @IsString()
    idToken: string;

    @IsOptional()
    @IsString()
    firstName?: string;

    @IsOptional()
    @IsString()
    lastName?: string;
}