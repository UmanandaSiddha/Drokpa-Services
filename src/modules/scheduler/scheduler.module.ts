import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { DatabaseService } from 'src/services/database/database.service';
import { S3Module } from 'src/modules/s3/s3.module';
import { EmailService } from 'src/services/email/email.service';
import { DatabaseModule } from 'src/services/database/database.module';
import { EmailModule } from 'src/services/email/email.module';

@Module({
    imports: [S3Module, DatabaseModule, EmailModule],
    providers: [SchedulerService],
})
export class SchedulerModule { }