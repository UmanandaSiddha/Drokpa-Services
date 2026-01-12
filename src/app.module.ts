import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from './services/logger/logger.module';
import { QueueModule } from './services/queue/queue.module';
import { HealthModule } from './modules/health/health.module';
import { RedisModule } from './services/redis/redis.module';
import { S3Module } from './modules/s3/s3.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/users/users.module';
import { DatabaseModule } from './services/database/database.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EmailModule } from './services/email/email.module';
import { PaymentModule } from './modules/payment/payment.module';
import { BookingModule } from './modules/booking/booking.module';
import { BucketListModule } from './modules/bucketlist/bucketlist.module';
import { VehicleModule } from './modules/vehicle/vehicle.module';
import { LocalGuideModule } from './modules/local-guide/local-guide.module';
import { POIModule } from './modules/poi/poi.module';
import { PermitModule } from './modules/permit/permit.module';
import { IdentityModule } from './modules/identity/identity.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { FeatureFlagModule } from './modules/feature-flag/feature-flag.module';
import { AddressModule } from './modules/address/address.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { MemoriesModule } from './modules/memories/memories.module';
import { AdminModule } from './modules/admin/admin.module';
import { WebhookModule } from './modules/webhook/webhook.module';
import { ToursModule } from './modules/tours/tours.module';
import { HomestayModule } from './modules/homestay/homestay.module';

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
		}),
		EventEmitterModule.forRoot(),
		LoggerModule,
		QueueModule,
		HealthModule,
		RedisModule,
		S3Module,
		AuthModule,
		UserModule,
		DatabaseModule,
		EmailModule,
		PaymentModule,
		BookingModule,
		BucketListModule,
		VehicleModule,
		LocalGuideModule,
		POIModule,
		PermitModule,
		IdentityModule,
		OnboardingModule,
		FeatureFlagModule,
		AddressModule,
		ReviewsModule,
		MemoriesModule,
		AdminModule,
		WebhookModule,
		ToursModule,
		HomestayModule,
	],
	controllers: [AppController],
	providers: [AppService],
})
export class AppModule { }
