import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WEBHOOK_QUEUE } from 'src/config/constants';
import { WebhookController } from './webhook.controller';
import { WebhookProcessor } from './webhook.processor';
import { WebhookQueueEventsListener } from './webhook.events';
import { WebhookService } from './webhook.service';
import { DatabaseModule } from 'src/services/database/database.module';
import { EmailModule } from 'src/services/email/email.module';

@Module({
    imports: [
        DatabaseModule,
        EmailModule,
        BullModule.registerQueue({
            name: WEBHOOK_QUEUE,
        }),
    ],
    controllers: [WebhookController],
    providers: [WebhookService, WebhookProcessor, WebhookQueueEventsListener],
})
export class WebhookModule { }
