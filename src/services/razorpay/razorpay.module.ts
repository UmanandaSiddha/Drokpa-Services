import { Global, Module, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RAZORPAY_CLIENT } from 'src/config/constants';
import { RazorpayService } from './razorpay.service';

@Global()
@Module({
	providers: [
		{
			provide: RAZORPAY_CLIENT,
			inject: [ConfigService],
			useFactory: (
				configService: ConfigService,
			) => {
				const keyId = configService.get<string>('RAZORPAY_KEY_ID');
				const keySecret = configService.get<string>('RAZORPAY_KEY_SECRET');
				
				if (!keyId || !keySecret) {
					const logger = new Logger('RazorpayModule');
					logger.warn('Razorpay credentials not configured. Payment features will be disabled.');
					return null;
				}
				
				// eslint-disable-next-line @typescript-eslint/no-var-requires
				const Razorpay = require('razorpay');
				return new Razorpay({
					key_id: keyId,
					key_secret: keySecret,
				});
			},
		},
		RazorpayService
	],
	exports: [RAZORPAY_CLIENT, RazorpayService],
})
export class RazorpayModule { }
