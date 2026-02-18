import { BadRequestException, Controller, Headers, HttpCode, Post, Req, RawBodyRequest } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as crypto from 'crypto';
import { WebhookService } from "./webhook.service";

@Controller('webhook')
export class WebhookController {
    constructor(
        private readonly webhookService: WebhookService,
        private readonly configService: ConfigService,
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

        // ✅ Verify Razorpay signature
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(rawBody)
            .digest('hex');

        if (expectedSignature !== signature) {
            throw new BadRequestException('Invalid Razorpay signature');
        }

        // ✅ Parse and delegate to service
        const event = JSON.parse(rawBody.toString());
        return this.webhookService.processRazorpayWebhook(event);
    }

}