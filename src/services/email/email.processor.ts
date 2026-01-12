import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { EMAIL_QUEUE } from 'src/config/constants';
import { EmailService } from './email.service';
import { SendEmailDto } from './dto/send-email.dto';

@Processor(EMAIL_QUEUE, {
    concurrency: 5,
})
export class EmailProcessor extends WorkerHost {
    private readonly logger = new Logger(EmailProcessor.name);

    constructor(
        private readonly emailService: EmailService,
    ) {
        super();
        this.logger.log('EmailProcessor initialized');
    }

    async process(job: Job<SendEmailDto, any, string>): Promise<any> {
        this.logger.log(`Processing email job: ${job.name} with ID: ${job.id}, To: ${job.data.to}`);

        try {
            await this.emailService.sendEmail(job.data);
            return { success: true, messageId: job.id };
        } catch (error) {
            this.logger.error(`EMAIL_QUEUE job ${job.id} (${job.name}) failed:`, error.message);
            this.logger.error('Stack trace:', error.stack);
            throw error;
        }
    }

    @OnWorkerEvent('active')
    onActive(job: Job) {
        this.logger.log(`🟡 EMAIL_QUEUE job ${job.id} (${job.name}) is now ACTIVE`);
    }

    @OnWorkerEvent('completed')
    onCompleted(job: Job, result: any) {
        this.logger.log(`✅ EMAIL_QUEUE job ${job.id} (${job.name}) COMPLETED!`);
        if (result) {
            this.logger.debug(`Job result:`, JSON.stringify(result));
        }
    }

    @OnWorkerEvent('failed')
    onFailed(job: Job, err: Error) {
        this.logger.error(`❌ EMAIL_QUEUE job ${job.id} (${job.name}) FAILED! Attempt ${job.attemptsMade}/${job.opts.attempts}`);
        this.logger.error(`Error: ${err.message}`);
    }

    @OnWorkerEvent('stalled')
    onStalled(jobId: string) {
        this.logger.warn(`⚠️ EMAIL_QUEUE job ${jobId} STALLED`);
    }

    @OnWorkerEvent('error')
    onError(err: Error) {
        this.logger.error('🔴 EMAIL_QUEUE worker error:', err.message);
        this.logger.error('EMAIL_QUEUE worker error stack:', err.stack);
    }

    @OnWorkerEvent('ready')
    onReady() {
        this.logger.log('🟢 EMAIL_QUEUE Worker is ready');
    }
}
