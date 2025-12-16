import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { S3Service } from './s3.service';
import { AuthModule } from 'src/modules/auth/auth.module';
import { S3Controller } from './s3.controller';
import { DatabaseModule } from 'src/services/database/database.module';

@Module({
    imports: [ConfigModule, AuthModule, DatabaseModule],
    controllers: [S3Controller],
    providers: [
        {
            provide: 'S3_CLIENT',
            useFactory: (configService: ConfigService) => {
                return new S3Client({
                    region: configService.get<string>('AWS_REGION'),
                    credentials: {
                        accessKeyId: configService.get<string>('AWS_ACCESS_KEY_ID'),
                        secretAccessKey: configService.get<string>('AWS_SECRET_ACCESS_KEY'),
                    },
                });
            },
            inject: [ConfigService],
        },
        S3Service,
    ],
    exports: [S3Service],
})
export class S3Module { }
