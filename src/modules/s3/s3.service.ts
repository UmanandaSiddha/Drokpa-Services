import { Injectable, Inject, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as path from 'path';
import { FileInfo, UploadType, UploadUrlResponse } from './dto/s3.interface';
import { ALLOWED_MIME_TYPES } from 'src/utils/s3.helper';
import { DatabaseService } from 'src/services/database/database.service';
import { LoggerService } from 'src/services/logger/logger.service';

@Injectable()
export class S3Service {
    private readonly bucketName: string;
    private readonly logger = new LoggerService(S3Service.name);

    constructor(
        private readonly configService: ConfigService,
        @Inject('S3_CLIENT') private readonly s3Client: S3Client,
        private readonly databaseService: DatabaseService,
    ) {
        this.bucketName = this.configService.get<string>('AWS_S3_BUCKET_NAME');
    }

    /**
     * Generates a pre-signed URL for a single file upload.
     * @param uploadType The category of the upload (e.g., AVATAR).
     * @param contextId A relevant ID for folder structure (e.g., userId, outletId).
     * @param file The file information.
     * @param userId Optional: user ID for tracking uploads
     */
    async getUploadUrl(uploadType: UploadType, contextId: string, file: FileInfo, userId?: string): Promise<UploadUrlResponse> {
        if (!ALLOWED_MIME_TYPES.includes(file.fileType as typeof ALLOWED_MIME_TYPES[number])) {
            throw new BadRequestException('File type not allowed');
        }

        const key = this._generateS3Key(uploadType, contextId, file.originalFileName);

        const command = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            ContentType: file.fileType,
        });

        const presignedUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 60 * 5 }); // 5 minutes

        // Track the temporary upload
        if (userId) {
            try {
                await this.databaseService.temporaryUpload.create({
                    data: {
                        userId,
                        s3Key: key,
                        s3Bucket: this.bucketName,
                        fileName: file.originalFileName,
                        size: 0, // FileInfo doesn't include size at upload URL generation
                        mimeType: file.fileType,
                        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days default
                        isUsed: false,
                    },
                });
                this.logger.debug(`Tracked TemporaryUpload for user ${userId}: ${key}`);
            } catch (error) {
                this.logger.warn(`Failed to track TemporaryUpload: ${error.message}`);
                // Don't fail the upload if tracking fails
            }
        }

        return {
            presignedUrl,
            publicUrl: this._getPublicUrl(key),
        };
    }

    /**
     * Generates multiple pre-signed URLs for a bulk file upload.
     * @param uploadType The category of the uploads.
     * @param contextId A relevant ID for folder structure.
     * @param files An array of file information objects.
     * @param userId Optional: user ID for tracking uploads
     */
    async getUploadUrls(uploadType: UploadType, contextId: string, files: FileInfo[], userId?: string): Promise<UploadUrlResponse[]> {
        const invalidFiles = files.filter(f => !ALLOWED_MIME_TYPES.includes(f.fileType as typeof ALLOWED_MIME_TYPES[number]));
        if (invalidFiles.length > 0) {
            throw new BadRequestException(
                `File type(s) not allowed: ${invalidFiles.map(f => f.fileType).join(', ')}`,
            );
        }

        const uploadPromises = files.map(async (file) => {
            const key = this._generateS3Key(uploadType, contextId, file.originalFileName);

            const command = new PutObjectCommand({
                Bucket: this.bucketName,
                Key: key,
                ContentType: file.fileType,
            });

            const presignedUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 }); // 1 hour for bulk uploads

            // Track the temporary upload
            if (userId) {
                try {
                    await this.databaseService.temporaryUpload.create({
                        data: {
                            userId,
                            s3Key: key,
                            s3Bucket: this.bucketName,
                            fileName: file.originalFileName,
                            size: 0, // FileInfo doesn't include size at upload URL generation
                            mimeType: file.fileType,
                            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days default
                            isUsed: false,
                        },
                    });
                    this.logger.debug(`Tracked TemporaryUpload for user ${userId}: ${key}`);
                } catch (error) {
                    this.logger.warn(`Failed to track TemporaryUpload: ${error.message}`);
                    // Don't fail the upload if tracking fails
                }
            }

            return {
                presignedUrl,
                publicUrl: this._getPublicUrl(key),
            };
        });

        return Promise.all(uploadPromises);
    }

    /**
     * Deletes an object from the S3 bucket and marks TemporaryUpload as used.
     * @param key The full key (path) of the object to delete.
     */
    async deleteObject(key: string): Promise<{ success: boolean }> {
        if (!key) {
            throw new BadRequestException('Object key cannot be empty.');
        }
        try {
            await this.s3Client.send(
                new DeleteObjectCommand({
                    Bucket: this.bucketName,
                    Key: key,
                })
            );

            // Mark as deleted/used
            try {
                await this.databaseService.temporaryUpload.updateMany({
                    where: { s3Key: key },
                    data: {
                        isUsed: true,
                        deletedAt: new Date()
                    },
                });
            } catch (error) {
                this.logger.warn(`Failed to update TemporaryUpload: ${error.message}`);
            }

            return { success: true };
        } catch (error) {
            throw new InternalServerErrorException(`Failed to delete object: ${error.message}`);
        }
    }

    /**
     * Private helper to generate a standardized, unique key for S3.
     * Format: {uploadType}/{contextId}/{uuid}.{extension}
     * Example: menu-items/outlet-123/abc-123-def-456.jpg
     */
    private _generateS3Key(uploadType: UploadType, contextId: string, originalFileName: string): string {
        const safeContextId = contextId.replace(/[^a-zA-Z0-9\-_]/g, '');
        const fileExtension = path.extname(originalFileName); // e.g., '.jpg'
        if (!fileExtension) {
            throw new BadRequestException('File must have an extension');
        }
        const uniqueId = crypto.randomUUID();
        return `${uploadType}/${safeContextId}/${uniqueId}${fileExtension}`;
    }

    /**
     * Private helper to construct the public URL for a given S3 key.
     */
    private _getPublicUrl(key: string): string {
        // Note: Ensure your S3 bucket has public access enabled if you use this URL directly.
        const region = this.configService.get<string>('AWS_REGION');
        return `https://${this.bucketName}.s3.${region}.amazonaws.com/${key}`;
    }

    /**
     * Get storage usage statistics (admin)
     */
    async getStorageUsage() {
        const [totalUploads, usedUploads, expiredUploads, totalSize] = await Promise.all([
            this.databaseService.temporaryUpload.count(),
            this.databaseService.temporaryUpload.count({ where: { isUsed: true } }),
            this.databaseService.temporaryUpload.count({
                where: { expiresAt: { lt: new Date() } },
            }),
            this.databaseService.temporaryUpload.aggregate({
                _sum: { size: true },
            }),
        ]);

        return {
            totalUploads,
            usedUploads,
            pendingUploads: totalUploads - usedUploads,
            expiredUploads,
            totalSizeBytes: totalSize._sum.size ?? 0,
            totalSizeMB: Math.round((totalSize._sum.size ?? 0) / (1024 * 1024) * 100) / 100,
        };
    }

    /**
     * Clean up expired temporary uploads
     */
    async cleanupExpiredUploads(): Promise<{ deletedCount: number }> {
        const expiredUploads = await this.databaseService.temporaryUpload.findMany({
            where: {
                expiresAt: { lt: new Date() },
                isUsed: false,
            },
            select: { s3Key: true, id: true },
        });

        if (expiredUploads.length === 0) {
            return { deletedCount: 0 };
        }

        let deletedCount = 0;

        for (const upload of expiredUploads) {
            try {
                // Delete from S3
                await this.s3Client.send(
                    new DeleteObjectCommand({
                        Bucket: this.bucketName,
                        Key: upload.s3Key,
                    })
                );
                // Delete from database
                await this.databaseService.temporaryUpload.delete({
                    where: { id: upload.id },
                });
                deletedCount++;
            } catch (error) {
                this.logger.error(`Failed to clean up ${upload.s3Key}: ${error.message}`);
            }
        }

        this.logger.log(`Cleaned up ${deletedCount} expired uploads`);
        return { deletedCount };
    }
}