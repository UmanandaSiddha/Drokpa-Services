import { Response } from 'express';
import {
	Body,
	Controller,
	Get,
	Post,
	Put,
	Req,
	Res,
	UseGuards,
} from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import {
	OtpDto,
	SignUpDto,
	LoginDto,
} from './dto';
import { AuthGuard, getUser } from './guards/auth.guard';
import { Request } from 'express';
import { RequestDto } from './dto/request.dto';
import { ResetPasswordDto } from './dto/reset.password.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';

@Controller('auth')
export class AuthController {
	constructor(private readonly authService: AuthService) { }

	// REQUEST-OTP — moderate: 10 req / 60s
	@Post('request-otp')
	@Throttle({ default: { ttl: 60000, limit: 10 } })
	requestOtp(@Body() dto: RequestDto) {
		return this.authService.requestOtp(dto);
	}

	// SIGN-UP — moderate: 10 req / 60s
	@Post('sign-up')
	@Throttle({ default: { ttl: 60000, limit: 10 } })
	signUp(@Body() dto: SignUpDto, @Res({ passthrough: true }) res: Response) {
		return this.authService.signUp(dto, res);
	}

	// REFRESH-TOKEN
	@Post('refresh-token')
	refreshToken(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
		return this.authService.refreshToken(req, res);
	}

	// VERIFY-OTP — moderate: 20 req / 60s
	@Post('verify-otp')
	@Throttle({ default: { ttl: 60000, limit: 20 } })
	verifyOtp(@Body() dto: OtpDto, @Res({ passthrough: true }) res: Response) {
		return this.authService.verifyOtp(dto, res);
	}

	// SIGN-IN — moderate: 30 req / 60s (allows multiple attempts)
	@Post('sign-in')
	@Throttle({ default: { ttl: 60000, limit: 30 } })
	signIn(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
		return this.authService.signIn(dto, res);
	}

	// LOGOUT — no throttle needed (requires auth)
	@UseGuards(AuthGuard)
	@Post('logout')
	@SkipThrottle()
	async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response, @getUser('id') userId: string) {
		return this.authService.logout(req, res, userId);
	}

	// REQUEST PASSWORD RESET — moderate: 10 req / 60s
	@Post('forgot-password')
	@Throttle({ default: { ttl: 60000, limit: 10 } })
	requestPasswordReset(@Body() dto: RequestDto) {
		return this.authService.requestPasswordReset(dto);
	}

	// RESET PASSWORD — moderate: 15 req / 60s
	@Post('reset-password')
	@Throttle({ default: { ttl: 60000, limit: 15 } })
	resetPassword(@Body() dto: ResetPasswordDto) {
		return this.authService.resetPassword(dto);
	}

	// GOOGLE AUTH — moderate: 20 req / 60s
	@Post('google')
	@Throttle({ default: { ttl: 60000, limit: 20 } })
	async googleAuth(
		@Body() dto: GoogleAuthDto,
		@Res({ passthrough: true }) res: Response,
	) {
		return this.authService.googleAuth(dto, res);
	}
}
