import { ArrayMinSize, IsArray, IsEnum, IsIn, IsNotEmpty, IsString, ValidateNested } from "class-validator";
import { FileInfo, UploadType } from "./s3.interface";
import { Type } from "class-transformer";
import { ALLOWED_MIME_TYPES } from "src/utils/s3.helper";

export class FileInfoDto implements FileInfo {
    @IsString()
    @IsNotEmpty()
    originalFileName: string;

    @IsIn(ALLOWED_MIME_TYPES)
    fileType: string;
}

export class GetPresignedUrlsDto {
    @IsNotEmpty()
    @IsEnum(UploadType)
    uploadType: UploadType;

    @IsString()
    @IsNotEmpty()
    contextId: string;

    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => FileInfoDto)
    files: FileInfoDto[];
}