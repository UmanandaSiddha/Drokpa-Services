import { IsString, IsOptional } from 'class-validator';

export class SubmitPermitDto {
    @IsString()
    @IsOptional()
    passportPhotoId?: string;

    @IsString()
    @IsOptional()
    identityProofId?: string;
}
