import {
    QueueEventsHost,
    QueueEventsListener,
    OnQueueEvent,
} from '@nestjs/bullmq';
import { WEBHOOK_QUEUE } from 'src/config/constants';

@QueueEventsListener(WEBHOOK_QUEUE)
export class WebhookQueueEventsListener extends QueueEventsHost {

    @OnQueueEvent('added')
    onActive(job: { jobId: string; name: string; prev?: string }) {
        console.log(`Job ${job.jobId} has been added to the ${WEBHOOK_QUEUE}`);
    }
}