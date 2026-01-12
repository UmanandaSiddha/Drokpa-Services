import { Module } from '@nestjs/common';
import { BucketListController } from './bucketlist.controller';
import { BucketListService } from './bucketlist.service';
import { DatabaseModule } from 'src/services/database/database.module';
import { AuthModule } from 'src/modules/auth/auth.module';

@Module({
    imports: [DatabaseModule, AuthModule],
    controllers: [BucketListController],
    providers: [BucketListService],
    exports: [BucketListService],
})
export class BucketListModule { }
