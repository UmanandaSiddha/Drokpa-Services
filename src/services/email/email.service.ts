import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EMAIL_QUEUE } from 'src/config/constants';
import { SendEmailDto } from './dto/send-email.dto';

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);
    private readonly sesClient?: SESClient;
    private readonly fromEmail: string;

    constructor(
        private readonly configService: ConfigService,
        @InjectQueue(EMAIL_QUEUE) private readonly emailQueue: Queue,
    ) {
        const awsRegion = this.configService.get<string>('AWS_REGION');
        const awsAccessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
        const awsSecretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');
        
        if (awsRegion && awsAccessKeyId && awsSecretAccessKey) {
            this.sesClient = new SESClient({
                region: awsRegion,
                credentials: {
                    accessKeyId: awsAccessKeyId,
                    secretAccessKey: awsSecretAccessKey,
                },
            });
        } else {
            this.logger.warn('AWS SES credentials not configured. Email sending will be disabled.');
        }
        
        this.fromEmail = this.configService.get<string>('SES_FROM_EMAIL') || 'noreply@drokpa.com';
    }

    /**
     * Queue an email to be sent asynchronously
     * Only queues in production mode
     */
    async queueEmail(dto: SendEmailDto): Promise<void> {
        const isProduction = process.env.NODE_ENV === 'production';
        
        if (!isProduction) {
            this.logger.log(`[DEV] Email not queued (production mode only): ${dto.to} - ${dto.subject}`);
            return;
        }

        await this.emailQueue.add('send-email', dto, {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 2000,
            },
        });
        this.logger.log(`Email queued for ${dto.to}`);
    }

    /**
     * Send email directly via AWS SES
     */
    async sendEmail(dto: SendEmailDto): Promise<void> {
        if (!this.sesClient) {
            this.logger.warn('AWS SES client not initialized. Email not sent.');
            return;
        }
        
        try {
            const command = new SendEmailCommand({
                Source: this.fromEmail,
                Destination: {
                    ToAddresses: [dto.to],
                },
                Message: {
                    Subject: {
                        Data: dto.subject,
                        Charset: 'UTF-8',
                    },
                    Body: {
                        ...(dto.html && {
                            Html: {
                                Data: dto.html,
                                Charset: 'UTF-8',
                            },
                        }),
                        ...(dto.text && {
                            Text: {
                                Data: dto.text,
                                Charset: 'UTF-8',
                            },
                        }),
                    },
                },
            });

            const response = await this.sesClient.send(command);
            this.logger.log(`Email sent successfully to ${dto.to}, MessageId: ${response.MessageId}`);
        } catch (error) {
            this.logger.error(`Failed to send email to ${dto.to}:`, error);
            throw error;
        }
    }

    /**
     * Send booking confirmation email
     */
    async sendBookingConfirmation(email: string, bookingData: any): Promise<void> {
        const html = this.getBookingConfirmationTemplate(bookingData);
        await this.queueEmail({
            to: email,
            subject: 'Booking Confirmed - Drokpa',
            html,
        });
    }

    /**
     * Send OTP email
     */
    async sendOtpEmail(email: string, otp: string): Promise<void> {
        const html = this.getOtpTemplate(otp);
        await this.queueEmail({
            to: email,
            subject: 'Your OTP - Drokpa',
            html,
        });
    }

    /**
     * Send booking request notification to provider
     */
    async sendBookingRequestNotification(email: string, bookingData: any): Promise<void> {
        const html = this.getBookingRequestTemplate(bookingData);
        await this.queueEmail({
            to: email,
            subject: 'New Booking Request - Drokpa',
            html,
        });
    }

    /**
     * Email templates
     */
    private getBookingConfirmationTemplate(bookingData: any): string {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; background-color: #f9f9f9; }
                    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Booking Confirmed!</h1>
                    </div>
                    <div class="content">
                        <p>Dear Customer,</p>
                        <p>Your booking has been confirmed successfully.</p>
                        <p><strong>Booking ID:</strong> ${bookingData.id}</p>
                        <p>Thank you for choosing Drokpa!</p>
                    </div>
                    <div class="footer">
                        <p>&copy; ${new Date().getFullYear()} Drokpa. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    private getOtpTemplate(otp: string): string {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #2196F3; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; background-color: #f9f9f9; }
                    .otp { font-size: 32px; font-weight: bold; text-align: center; padding: 20px; background-color: #fff; border: 2px dashed #2196F3; margin: 20px 0; }
                    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Your OTP</h1>
                    </div>
                    <div class="content">
                        <p>Your One-Time Password is:</p>
                        <div class="otp">${otp}</div>
                        <p>This OTP is valid for 10 minutes.</p>
                        <p>If you didn't request this, please ignore this email.</p>
                    </div>
                    <div class="footer">
                        <p>&copy; ${new Date().getFullYear()} Drokpa. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    private getBookingRequestTemplate(bookingData: any): string {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #FF9800; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; background-color: #f9f9f9; }
                    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>New Booking Request</h1>
                    </div>
                    <div class="content">
                        <p>Dear Provider,</p>
                        <p>You have received a new booking request.</p>
                        <p><strong>Booking ID:</strong> ${bookingData.id}</p>
                        <p>Please log in to your dashboard to review and confirm the booking.</p>
                    </div>
                    <div class="footer">
                        <p>&copy; ${new Date().getFullYear()} Drokpa. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }
}
