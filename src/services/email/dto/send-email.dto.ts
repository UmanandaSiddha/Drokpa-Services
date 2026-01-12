import { IsEmail, IsString, IsOptional, IsObject } from 'class-validator';

export class SendEmailDto {
    @IsEmail()
    to: string;

    @IsString()
    subject: string;

    @IsString()
    @IsOptional()
    text?: string;

    @IsString()
    @IsOptional()
    html?: string;

    @IsObject()
    @IsOptional()
    templateData?: Record<string, any>;

    @IsString()
    @IsOptional()
    templateName?: string;
}
