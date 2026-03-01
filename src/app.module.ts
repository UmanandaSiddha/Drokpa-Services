import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
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
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { FeatureFlagModule } from './modules/feature-flag/feature-flag.module';
import { AddressModule } from './modules/address/address.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { MemoriesModule } from './modules/memories/memories.module';
import { AdminModule } from './modules/admin/admin.module';
import { WebhookModule } from './modules/webhook/webhook.module';
import { ToursModule } from './modules/tours/tours.module';
import { HomestayModule } from './modules/homestay/homestay.module';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { PayoutModule } from './modules/payout/payout.module';
import { RoomAvailabilityModule } from './modules/room-availibility/room-availibility.module';
import { FirebaseAdminModule } from './services/firebase/firebase-admin.module';
import { ServiceWaitlistModule } from './modules/service-waitlist/service-waitlist.module';
import { CommunityModule } from './modules/community/community.module';
import { CouponModule } from './modules/coupon/coupon.module';
import { TagsModule } from './modules/tags/tags.module';
import { FacilitiesModule } from './modules/facilities/facilities.module';
import { OfflineRoomBookingModule } from './modules/offline-room-booking/offline-room-booking.module';
import { Module } from '@nestjs/common';

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
		}),
		ThrottlerModule.forRoot([{
			ttl: 60000,
			limit: 60,
		}]),
		EventEmitterModule.forRoot(),
		ScheduleModule.forRoot(),
		SchedulerModule,
		LoggerModule,
		QueueModule,
		HealthModule,
		RedisModule,
		FirebaseAdminModule,
		S3Module,
		AuthModule,
		UserModule,
		DatabaseModule,
		EmailModule,
		PaymentModule,
		PayoutModule,
		RoomAvailabilityModule,
		BookingModule,
		BucketListModule,
		VehicleModule,
		LocalGuideModule,
		POIModule,
		PermitModule,
		OnboardingModule,
		FeatureFlagModule,
		AddressModule,
		ReviewsModule,
		MemoriesModule,
		AdminModule,
		WebhookModule,
		ToursModule,
		HomestayModule,
		ServiceWaitlistModule,
		CommunityModule,
		CouponModule,
		TagsModule,
		FacilitiesModule,
		OfflineRoomBookingModule,
	],
	controllers: [AppController],
	providers: [
		AppService,
		{
			provide: APP_GUARD,
			useClass: ThrottlerGuard,
		},
	],
})
export class AppModule { }
