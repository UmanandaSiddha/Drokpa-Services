import { InjectQueue } from "@nestjs/bullmq";
import { BadRequestException, Controller, Headers, HttpCode, Post, Req, RawBodyRequest } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import * as crypto from 'crypto';
import { WEBHOOK_QUEUE } from "src/config/constants";
import { DatabaseService } from "src/services/database/database.service";

@Controller('webhook')
export class WebhookController {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly configService: ConfigService,
        @InjectQueue(WEBHOOK_QUEUE) private readonly webhookQueue: Queue,
    ) { }

    @Post('razorpay')
    @HttpCode(200)
    async handleWebhook(
        @Req() req: RawBodyRequest<Request>,
        @Headers('x-razorpay-signature') signature: string,
    ) {
        const secret = this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET');
        if (!secret) throw new BadRequestException('Webhook secret missing');

        const rawBody = req.rawBody as Buffer;

        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(rawBody)
            .digest('hex');

        if (expectedSignature !== signature) {
            throw new BadRequestException('Invalid Razorpay signature');
        }

        const event = JSON.parse(rawBody.toString());
        const eventId = event.id;
        const eventType = event.event;

        // ✅ IDEMPOTENCY CHECK
        const alreadyExists = await this.databaseService.webhookEvent.findUnique({
            where: { providerEventId: eventId },
        });

        if (alreadyExists) {
            // Duplicate webhook → ACK safely
            return { received: true, duplicate: true };
        }

        // ✅ Persist event FIRST (critical)
        await this.databaseService.webhookEvent.create({
            data: {
                provider: 'RAZORPAY',
                providerEventId: eventId,
                eventType,
                rawBody: event,
            },
        });

        // 👉 enqueue for async processing (next section)
        await this.webhookQueue.add('razorpay', {
            eventId,
        });

        return { received: true };
    }

}