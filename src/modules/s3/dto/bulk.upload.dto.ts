import { IsArray, IsNotEmpty, IsString, ValidateNested } from "class-validator";
import { FileInfo, UploadType } from "./s3.interface";
import { Type } from "class-transformer";

export class FileInfoDto implements FileInfo {
    @IsString()
    @IsNotEmpty()
    originalFileName: string;

    @IsString()
    @IsNotEmpty()
    fileType: string;
}

export class GetPresignedUrlsDto {
    @IsNotEmpty()
    @IsString()
    uploadType: UploadType;

    @IsString()
    @IsNotEmpty()
    contextId: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => FileInfoDto)
    files: FileInfoDto[];
}