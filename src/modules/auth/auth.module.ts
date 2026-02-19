import { Module, forwardRef } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthGuard } from './guards/auth.guard';
import { DatabaseModule } from 'src/services/database/database.module';
import { SocketGuard } from './guards/socket.guard';
import { EmailModule } from 'src/services/email/email.module';
import { OnboardingModule } from 'src/modules/onboarding/onboarding.module';
import { RoleGuard } from './guards/role.guard';
import { RedisModule } from 'src/services/redis/redis.module';

@Module({
	imports: [
		ConfigModule,
		DatabaseModule,
		EmailModule,
		RedisModule,
		forwardRef(() => OnboardingModule),
		JwtModule.registerAsync({
			inject: [ConfigService],
			useFactory: async (configService: ConfigService) => ({
				secret: configService.getOrThrow<string>('ACCESS_TOKEN_SECRET'),
				signOptions: { expiresIn: '15m' },
			}),
		}),
	],
	controllers: [AuthController],
	providers: [AuthService, AuthGuard, RoleGuard, SocketGuard],
	exports: [AuthService, JwtModule, AuthGuard, RoleGuard, SocketGuard],
})
export class AuthModule { }
