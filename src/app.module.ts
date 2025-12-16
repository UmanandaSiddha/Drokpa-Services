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
	],
	controllers: [AppController],
	providers: [AppService],
})
export class AppModule { }
