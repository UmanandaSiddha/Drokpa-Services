import { IsOptional, IsUUID } from 'class-validator';

export class SubmitPermitDto {
    @IsOptional()
    @IsUUID()
    passportPhotoId?: string;

    @IsOptional()
    @IsUUID()
    identityProofId?: string;
}