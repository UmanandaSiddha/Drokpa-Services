import { IsEnum, IsIn, IsNotEmpty, IsString } from 'class-validator';
import { UploadType } from './s3.interface';
import { ALLOWED_MIME_TYPES } from 'src/utils/s3.helper';

export class GetPresignedUrlDto {
    @IsEnum(UploadType)
    uploadType: UploadType;

    @IsString()
    @IsNotEmpty()
    contextId: string;

    @IsString()
    @IsNotEmpty()
    fileName: string;

    @IsIn(ALLOWED_MIME_TYPES)
    fileType: string;
}