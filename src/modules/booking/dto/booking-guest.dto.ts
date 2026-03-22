import { IsDateString, IsEmail, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Gender } from 'generated/prisma/enums';

export class BookingGuestDto {
    @IsString()
    fullName: string;

    @IsString()
    contactNumber: string;

    @IsOptional()
    @IsEmail()
    email?: string;

    @IsInt()
    @Min(1)
    age: number;

    @IsEnum(Gender)
    gender: Gender;

    @IsOptional()
    @IsString()
    passportPhotoId?: string;

    @IsOptional()
    @IsString()
    identityProofId?: string;

    @IsOptional()
    @IsDateString()
    dateOfArrival?: string;
}