import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Gender } from 'generated/prisma/client';

export class BookingGuestDto {
    @IsString()
    fullName: string;

    @IsString()
    contactNumber: string;

    @IsInt()
    @Min(0)
    age: number;

    @IsEnum(Gender)
    gender: Gender;

    @IsOptional()
    @IsString()
    passportPhotoId?: string;

    @IsOptional()
    @IsString()
    identityProofId?: string;
}