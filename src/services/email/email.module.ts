import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { EMAIL_QUEUE } from 'src/config/constants';
import { EmailService } from './email.service';
import { EmailProcessor } from './email.processor';

@Module({
    imports: [
        ConfigModule,
        BullModule.registerQueue({
            name: EMAIL_QUEUE,
        }),
    ],
    providers: [EmailService, EmailProcessor],
    exports: [EmailService],
})
export class EmailModule { }
