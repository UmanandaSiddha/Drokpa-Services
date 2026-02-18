import { Gender } from 'generated/prisma/enums';
import {
    IsDateString,
    IsEnum,
    IsOptional,
    IsPhoneNumber,
    IsString,
    IsUrl,
} from 'class-validator';

export class ProfileDto {
    @IsString()
    @IsOptional()
    firstName: string;

    @IsString()
    @IsOptional()
    lastName: string;

    @IsEnum(Gender)
    @IsOptional()
    gender?: Gender;

    @IsDateString()
    @IsOptional()
    dateOfBirth?: string;

    @IsUrl()
    @IsOptional()
    avatarUrl?: string;

    @IsPhoneNumber()
    @IsOptional()
    phoneNumber?: string;
}
