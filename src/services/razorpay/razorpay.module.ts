import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Razorpay from 'razorpay';
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
				return new Razorpay({
					key_id: configService.get<string>('RAZORPAY_KEY_ID'),
					key_secret:
						configService.get<string>('RAZORPAY_KEY_SECRET'),
				});
			},
		},
		RazorpayService
	],
	exports: [RAZORPAY_CLIENT],
})
export class RazorpayModule { }
