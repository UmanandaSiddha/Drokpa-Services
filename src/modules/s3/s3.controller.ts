import { Body, Controller, Delete, Post, UseGuards } from '@nestjs/common';
import { S3Service } from './s3.service';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { UploadUrlResponse } from './dto/s3.interface';
import { GetPresignedUrlsDto } from './dto/bulk.upload.dto';
import { DeleteObjectDto } from './dto/delete.object.dto';
import { GetPresignedUrlDto } from './dto/single.upload.dto';

@Controller('s3')
@UseGuards(AuthGuard)
export class S3Controller {
    constructor(private readonly s3Service: S3Service) { }

    @Post('presigned-url')
    async getPresignedUrl(@Body() dto: GetPresignedUrlDto): Promise<UploadUrlResponse> {
        return this.s3Service.getUploadUrl(dto.uploadType, dto.contextId, {
            originalFileName: dto.fileName,
            fileType: dto.fileType,
        });
    }

    @Post('presigned-urls')
    async getPresignedUrls(@Body() dto: GetPresignedUrlsDto): Promise<UploadUrlResponse[]> {
        const { uploadType, contextId, files } = dto;
        return this.s3Service.getUploadUrls(uploadType, contextId, files);
    }

    @Delete()
    async deleteObject(@Body() deleteObjectDto: DeleteObjectDto) {
        return this.s3Service.deleteObject(deleteObjectDto.key);
    }
}