import { Body, Controller, Delete, Get, ParseEnumPipe, Post, Query, UseGuards } from '@nestjs/common';
import { S3Service } from './s3.service';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { FileInfo, UploadType, UploadUrlResponse } from './dto/s3.interface';
import { GetPresignedUrlsDto } from './dto/bulk.upload.dto';
import { DeleteObjectDto } from './dto/delete.object.dto';

@Controller('s3')
@UseGuards(AuthGuard)
export class S3Controller {
    constructor(private readonly s3Service: S3Service) { }

    @Get('presigned-url')
    async getPresignedUrl(
        @Query('uploadType', new ParseEnumPipe(UploadType)) uploadType: UploadType,
        @Query('contextId') contextId: string,
        @Query('fileName') fileName: string,
        @Query('fileType') fileType: string,
    ): Promise<UploadUrlResponse> {
        const file: FileInfo = { originalFileName: fileName, fileType };
        return this.s3Service.getUploadUrl(uploadType, contextId, file);
    }

    @Post('presigned-urls')
    async getPresignedUrls(
        @Body() getPresignedUrlsDto: GetPresignedUrlsDto
    ): Promise<UploadUrlResponse[]> {
        const { uploadType, contextId, files } = getPresignedUrlsDto;
        return this.s3Service.getUploadUrls(uploadType, contextId, files);
    }

    /**
     * Deletes an object from S3. Using a POST request to safely pass the key,
     * which may contain special characters, in the request body.
     */
    @Delete('delete')
    async deleteObject(@Body() deleteObjectDto: DeleteObjectDto) {
        return this.s3Service.deleteObject(deleteObjectDto.key);
    }
}