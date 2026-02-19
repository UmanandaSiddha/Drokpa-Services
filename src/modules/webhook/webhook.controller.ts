import {
    Controller,
    Headers,
    HttpCode,
    Post,
    Req,
    RawBodyRequest,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { WebhookService } from './webhook.service';

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
        // Guard missing signature header before attempting comparison
        if (!signature) {
            throw new UnauthorizedException('Missing webhook signature');
        }

        const secret = this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET');
        if (!secret) {
            throw new UnauthorizedException('Webhook secret not configured');
        }

        const rawBody = req.rawBody as Buffer;

        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(rawBody)
            .digest('hex');

        // Use timing-safe comparison to prevent timing attacks
        const signaturesMatch = crypto.timingSafeEqual(
            Buffer.from(expectedSignature, 'hex'),
            Buffer.from(signature, 'hex'),
        );

        if (!signaturesMatch) {
            throw new UnauthorizedException('Invalid webhook signature');
        }

        const event = JSON.parse(rawBody.toString());
        return this.webhookService.processRazorpayWebhook(event);
    }
}