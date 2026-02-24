import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
	UnauthorizedException,
} from '@nestjs/common';
import {
	OtpDto,
	SignUpDto,
	LoginDto,
} from './dto';
import { DatabaseService } from 'src/services/database/database.service';
import { EmailService } from 'src/services/email/email.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Request, Response } from 'express';
import { RequestDto } from './dto/request.dto';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthProvider, Prisma, User, UserRole, UserRoleMap } from 'generated/prisma/client';
import { ResetPasswordDto } from './dto/reset.password.dto';
import { SAFE_USER_SELECT, SafeUser } from 'src/utils/auth.helper';
import { OnboardingService } from '../onboarding/onboarding.service';
import { RedisService } from 'src/services/redis/redis.service';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { FirebaseAdminService } from 'src/services/firebase/firebase-admin.service';
import type { auth } from 'firebase-admin';

@Injectable()
export class AuthService {

	constructor(
		private readonly databaseService: DatabaseService,
		private readonly config: ConfigService,
		private readonly jwtService: JwtService,
		private readonly emailService: EmailService,
		private readonly onboardingService: OnboardingService,
		private readonly redisService: RedisService,
		private readonly firebaseAdmin: FirebaseAdminService,
	) { }

	// --- Helper Functions ---

	// Verify user by token
	async validateUserByToken(token: string): Promise<SafeUser> {
		try {
			const secret = this.config.get<string>('ACCESS_TOKEN_SECRET');
			const payload: { id: string } = await this.jwtService.verifyAsync(token, { secret });

			const cacheKey = `auth:user:${payload.id}`;

			const cached = await this.redisService.get(cacheKey);
			if (cached) {
				const parsed: SafeUser = JSON.parse(cached);

				if (!Array.isArray(parsed.roles)) {
					throw new ForbiddenException('User roles not found');
				}

				return parsed;
			}

			const user = await this.databaseService.user.findUnique({
				where: { id: payload.id },
				select: {
					...SAFE_USER_SELECT,
					roles: true,
					provider: {
						select: { id: true },
					},
				},
			});
			if (!user || user.isDeleted) throw new UnauthorizedException('Invalid user.');

			const safeUser: SafeUser = {
				...user,
				providerId: user.provider?.id,
			};

			await this.redisService.set(cacheKey, JSON.stringify(safeUser), 60 * 5); // 5 min

			return safeUser;
		} catch (err: any) {
			if (err instanceof UnauthorizedException) throw err; // re-throw your own exceptions
			if (err.name === 'TokenExpiredError') throw new UnauthorizedException('Token expired.');
			throw new UnauthorizedException('Invalid token.');
		}
	}

	// Generate JWT Token
	generateToken(userId: string, type: "ACCESS_TOKEN" | "REFRESH_TOKEN", sessionId: string | null): string {
		const secret = type === "ACCESS_TOKEN"
			? this.config.get<string>('ACCESS_TOKEN_SECRET')
			: this.config.get<string>('REFRESH_TOKEN_SECRET');
		const expiresIn = type === "ACCESS_TOKEN" ? "15m" : "7d";

		const payload = type === "ACCESS_TOKEN" ? { id: userId } : { id: userId, sessionId: sessionId }

		return this.jwtService.sign(payload, { secret, expiresIn });
	}

	// Generate 6 digit OTP
	generateOTP(): { otpString: string, otpToken: string, otpExpire: number } {
		let otpString: string;
		if (this.config.get<string>('NODE_ENV') === "production") {
			otpString = Math.floor(100000 + Math.random() * 900000).toString();
		} else {
			otpString = '000000';
		}

		const otpToken = crypto
			.createHash("sha256")
			.update(otpString)
			.digest("hex");

		const otpExpire = Date.now() + 5 * 60 * 1000;

		return { otpString, otpToken, otpExpire }
	}

	// Send JWT Token to client cookies
	sendToken(res: Response, type: "ACCESS_TOKEN" | "REFRESH_TOKEN", token: string): void {
		const isProduction = this.config.get<string>('NODE_ENV') === 'production';
		const tokenName = type === "ACCESS_TOKEN" ? 'accessToken' : 'refreshToken';
		const age = type === "ACCESS_TOKEN" ? 15 : 7 * 24 * 60;

		res.cookie(tokenName, token, {
			httpOnly: true,
			secure: isProduction,
			sameSite: 'lax',
			maxAge: age * 60 * 1000,
			path: '/',
		});
	}

	// Clear client tokens
	clearToken(res: Response, type: "ACCESS_TOKEN" | "REFRESH_TOKEN"): void {
		const isProduction = this.config.get<string>('NODE_ENV') === 'production';
		const tokenName = type === "ACCESS_TOKEN" ? 'accessToken' : 'refreshToken';

		res.clearCookie(tokenName, {
			httpOnly: true,
			secure: isProduction,
			sameSite: 'lax',
			path: '/',
		});
	}

	private async issueSessionAndTokens(user: SafeUser, res: Response) {
		const session = await this.databaseService.session.create({
			data: {
				userId: user.id,
				refreshToken: '',
				expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
			},
		});

		const accessToken = this.generateToken(user.id, 'ACCESS_TOKEN', null);
		const refreshToken = this.generateToken(user.id, 'REFRESH_TOKEN', session.id);
		const hashedToken = await bcrypt.hash(refreshToken, 10);

		await this.databaseService.session.update({
			where: { id: session.id },
			data: { refreshToken: hashedToken },
		});

		const clientRefreshToken = `${session.id}.${refreshToken}`;
		this.sendToken(res, 'ACCESS_TOKEN', accessToken);
		this.sendToken(res, 'REFRESH_TOKEN', clientRefreshToken);

		return {
			message: 'Authenticated successfully',
			isNewUser: false,
			data: user,
		};
	}

	// --- Services ---

	// Request OTP
	async requestOtp(dto: RequestDto) {
		const { email } = dto;

		const user = await this.databaseService.user.findUnique({
			where: { email }
		});
		if (!user || user.isVerified) {
			return { message: 'If an account exists with this email, an OTP has been sent.', success: true };
		};

		const { otpString, otpToken, otpExpire } = this.generateOTP();

		await this.databaseService.user.update({
			where: { id: user.id },
			data: {
				oneTimePassword: otpToken,
				oneTimeExpire: new Date(otpExpire),
			},
		});

		// Send OTP email (production only)
		await this.emailService.sendOtpEmail(email, otpString);

		if (this.config.get<string>('NODE_ENV') !== "production") {
			console.log("OTP: ", otpString);
		}

		return { message: 'If an account exists with this email, an OTP has been sent.', success: true };
	}

	async signUp(dto: SignUpDto, res: Response) {
		const { firstName, lastName, email, password } = dto;

		const user = await this.databaseService.user.findUnique({
			where: { email }
		});
		if (user && !user.isDeleted) throw new BadRequestException('User already exists');
		if (user && user.isDeleted) {
			throw new BadRequestException('This account has been deleted. Contact support.');
		}

		const hashedPassword = await bcrypt.hash(password, 10);
		const { otpString, otpToken, otpExpire } = this.generateOTP();

		const newUser = await this.databaseService.user.create({
			data: {
				firstName,
				lastName,
				passwordHash: hashedPassword,
				email,
				roles: {
					create: {
						role: this.config.get('DEFAULT_ADMIN_EMAIL') === email ? UserRole.ADMIN : UserRole.USER
					}
				},
				authIdentities: {
					create: {
						provider: AuthProvider.PASSWORD,
						providerId: email,
					}
				},
				oneTimePassword: otpToken,
				oneTimeExpire: new Date(otpExpire)
			},
			select: {
				...SAFE_USER_SELECT,
				roles: true,
				provider: {
					select: { id: true },
				},
			},
		});

		const session = await this.databaseService.session.create({
			data: {
				userId: newUser.id,
				refreshToken: "",
				expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
			},
		});

		const accessToken = this.generateToken(newUser.id, "ACCESS_TOKEN", null);
		const refreshToken = this.generateToken(newUser.id, "REFRESH_TOKEN", session.id);

		const hashedToken = await bcrypt.hash(refreshToken, 10);

		await this.databaseService.session.update({
			where: { id: session.id },
			data: { refreshToken: hashedToken },
		});

		const clientRefreshToken = `${session.id}.${refreshToken}`;

		this.sendToken(res, "ACCESS_TOKEN", accessToken);
		this.sendToken(res, "REFRESH_TOKEN", clientRefreshToken);

		// Send welcome email with OTP (production only)
		await this.emailService.sendOtpEmail(email, otpString);

		if (this.config.get<string>('NODE_ENV') !== "production") {
			console.log("OTP: ", otpString);
		}

		const safeUser: SafeUser = {
			...newUser,
			providerId: newUser.provider?.id,
		};

		return {
			message: 'User registered successfully',
			data: safeUser,
		};
	}

	async verifyOtp(dto: OtpDto, res: Response) {
		const { otpString, email } = dto;
		const oneTimePassword = crypto.createHash("sha256").update(otpString).digest("hex");

		const user = await this.databaseService.user.findFirst({
			where: {
				email,
				oneTimePassword,
				oneTimeExpire: { gt: new Date() },
			},
		});
		if (!user) throw new BadRequestException('Invalid OTP or expired');

		const updatedUser = await this.databaseService.user.update({
			where: { id: user.id },
			data: {
				isVerified: true,
				oneTimePassword: null,
				oneTimeExpire: null
			},
			select: {
				...SAFE_USER_SELECT,
				roles: true,
				provider: {
					select: { id: true },
				},
			},
		});

		const onboardingResult = await this.onboardingService.checkAndCompleteOnboardingByEmail(
			email,
			user.id,
		);

		const session = await this.databaseService.session.create({
			data: {
				userId: user.id,
				refreshToken: "",
				expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
			},
		});

		const accessToken = this.generateToken(updatedUser.id, "ACCESS_TOKEN", null);
		const refreshToken = this.generateToken(updatedUser.id, "REFRESH_TOKEN", session.id);
		const hashedToken = await bcrypt.hash(refreshToken, 10);

		await this.databaseService.session.update({
			where: { id: session.id },
			data: { refreshToken: hashedToken },
		});

		const clientRefreshToken = `${session.id}.${refreshToken}`;

		this.sendToken(res, "ACCESS_TOKEN", accessToken);
		this.sendToken(res, "REFRESH_TOKEN", clientRefreshToken);

		const safeUser: SafeUser = {
			...updatedUser,
			providerId: updatedUser.provider?.id,
		};

		// Return response with onboarding status
		const response: any = {
			message: 'Email verified successfully',
			user: safeUser,
		};

		if (onboardingResult?.requiresCompletion) {
			response.onboardingPending = true;
			response.onboardingToken = onboardingResult.onboardingToken;
			response.message = 'Email verified. Please complete your provider onboarding using the token.';
		}

		// Send verification success email (production only)
		await this.emailService.queueEmail({
			to: email,
			subject: 'Account Verified - Drokpa',
			html: `
				<p>Dear ${updatedUser.firstName} ${updatedUser.lastName},</p>
				<p>Your account has been successfully verified!</p>
				<p>You can now enjoy all the features of Drokpa.</p>
				<p>Thank you for choosing Drokpa!</p>
			`,
		});

		return response;
	}

	async refreshToken(req: Request, res: Response) {
		const clientToken = req.cookies?.['refreshToken'] || req.headers.authorization?.split(' ')?.[1];
		if (!clientToken) throw new NotFoundException('Refresh token not found');

		const parts = clientToken.split(".");
		const sessionId = parts.shift();
		const token = parts.join(".");

		if (!sessionId || !token) throw new UnauthorizedException('Malformed token');

		try {
			const decoded = await this.jwtService.verifyAsync(token, { secret: this.config.get('REFRESH_TOKEN_SECRET') });

			const user = await this.databaseService.user.findUnique({
				where: { id: decoded.id },
			});
			if (!user || user.isDeleted) throw new UnauthorizedException('Invalid refresh token');

			if (sessionId !== decoded.sessionId) throw new ForbiddenException('Invalid session');

			const session = await this.databaseService.session.findUnique({
				where: { id: decoded.sessionId },
			});
			if (!session) throw new ForbiddenException('Session expired');

			if (session.expiresAt <= new Date(Date.now())) {
				await this.databaseService.session.delete({
					where: { id: session.id }
				});
				throw new ForbiddenException('Session expired');
			}

			const valid = await bcrypt.compare(token, session.refreshToken);
			if (!valid) throw new ForbiddenException('Invalid session');

			const accessToken = this.generateToken(user.id, "ACCESS_TOKEN", null);
			this.sendToken(res, "ACCESS_TOKEN", accessToken);

			return { message: 'User token refreshed successfully' };
		} catch (err) {
			if (err instanceof UnauthorizedException || err instanceof ForbiddenException) throw err;
			if (err.name === 'TokenExpiredError') throw new UnauthorizedException('Refresh token expired.');
			throw new UnauthorizedException('Invalid refresh token.');
		}
	}

	async signIn(dto: LoginDto, res: Response) {
		const { password, email } = dto;

		const user = await this.databaseService.user.findFirst({
			where: { email },
			select: {
				...SAFE_USER_SELECT,
				passwordHash: true,
				roles: true,
				provider: {
					select: { id: true },
				},
			},
		});
		if (!user) throw new BadRequestException('Invalid credentials.');
		if (user.isDeleted) throw new ForbiddenException('This account has been deleted.');
		if (user.isDisabled) throw new ForbiddenException('Account is disabled.');
		if (!user.passwordHash) throw new BadRequestException('This account uses a different login method.');

		const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
		if (!isPasswordValid) throw new BadRequestException('Invalid credentials');

		const session = await this.databaseService.session.create({
			data: {
				userId: user.id,
				refreshToken: "",
				expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
			},
		});

		const accessToken = this.generateToken(user.id, "ACCESS_TOKEN", null);
		const refreshToken = this.generateToken(user.id, "REFRESH_TOKEN", session.id);

		const hashedToken = await bcrypt.hash(refreshToken, 10);

		await this.databaseService.session.update({
			where: { id: session.id },
			data: { refreshToken: hashedToken },
		});

		const clientRefreshToken = `${session.id}.${refreshToken}`;

		this.sendToken(res, "ACCESS_TOKEN", accessToken);
		this.sendToken(res, "REFRESH_TOKEN", clientRefreshToken);

		const { passwordHash, ...userWithoutPassword } = user;
		const safeUser: SafeUser = {
			...userWithoutPassword,
			providerId: user.provider?.id,
		};

		return {
			message: 'User logged in successfully',
			data: safeUser,
		};
	}

	async logout(req: Request, res: Response, userId: string) {
		const refreshToken = req.cookies.refreshToken;

		if (refreshToken) {
			const [sessionId] = refreshToken.split(".");

			if (sessionId) {
				await this.databaseService.session.deleteMany({
					where: { id: sessionId, userId }
				});
			}
		}

		await this.invalidateUserCache(userId);

		this.clearToken(res, "ACCESS_TOKEN");
		this.clearToken(res, "REFRESH_TOKEN");

		return { success: true, message: 'User logged out successfully' }
	}

	async requestPasswordReset(dto: RequestDto) {
		const { email } = dto;

		const user = await this.databaseService.user.findUnique({
			where: { email }
		});
		if (!user || !user.passwordHash) {
			return { message: 'If an account exists with this email, a password reset link has been sent.', success: true };
		}

		const resetToken = crypto.randomBytes(32).toString('hex');
		const resetTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
		const resetTokenExpire = Date.now() + 60 * 60 * 1000; // 1 hour

		await this.databaseService.user.update({
			where: { id: user.id },
			data: {
				resetToken: resetTokenHash,
				resetTokenExpire: new Date(resetTokenExpire),
			},
		});

		// Send password reset email (production only)
		const resetUrl = `${this.config.get<string>('FRONTEND_URL') || 'https://www.drokpa.in'}/reset-password?token=${resetToken}`;
		await this.emailService.queueEmail({
			to: email,
			subject: 'Password Reset Request - Drokpa',
			html: `
				<p>Dear ${user.firstName} ${user.lastName},</p>
				<p>You requested a password reset. Click the link below to reset your password:</p>
				<p><a href="${resetUrl}">${resetUrl}</a></p>
				<p>This link will expire in 1 hour.</p>
				<p>If you didn't request this, please ignore this email.</p>
			`,
		});

		return { message: 'If an account exists with this email, a password reset link has been sent.', success: true };
	}

	async resetPassword(dto: ResetPasswordDto) {
		const { token, password: newPassword } = dto;

		const resetTokenHash = crypto.createHash("sha256").update(token).digest("hex");

		const user = await this.databaseService.user.findFirst({
			where: {
				resetToken: resetTokenHash,
				resetTokenExpire: { gt: new Date() },
			},
		});

		if (!user) {
			throw new BadRequestException('Invalid or expired reset token');
		}

		const hashedPassword = await bcrypt.hash(newPassword, 10);

		await this.databaseService.user.update({
			where: { id: user.id },
			data: {
				passwordHash: hashedPassword,
				resetToken: null,
				resetTokenExpire: null,
			},
		});

		// Send password reset confirmation email (production only)
		await this.emailService.queueEmail({
			to: user.email,
			subject: 'Password Reset Successful - Drokpa',
			html: `
				<p>Dear ${user.firstName} ${user.lastName},</p>
				<p>Your password has been successfully reset.</p>
				<p>If you didn't make this change, please contact support immediately.</p>
			`,
		});

		return { message: 'Password reset successfully', success: true };
	}

	async invalidateUserCache(userId: string) {
		await this.redisService.del(`auth:user:${userId}`);
	}

	async googleAuth(dto: GoogleAuthDto, res: Response) {
		const { idToken, firstName, lastName } = dto;

		// Verify the Firebase ID token
		let firebaseUser: auth.DecodedIdToken;
		try {
			firebaseUser = await this.firebaseAdmin.verifyIdToken(idToken)
		} catch {
			throw new UnauthorizedException('Invalid Google token');
		}

		const { uid, email, name, phone_number, picture } = firebaseUser;
		if (!email) throw new BadRequestException('Google account has no email');

		// Check if an AuthIdentity exists for this Google UID
		const existingIdentity = await this.databaseService.authIdentity.findUnique({
			where: {
				provider_providerId: {
					provider: AuthProvider.GOOGLE,
					providerId: uid,
				},
			},
			include: {
				user: {
					select: {
						...SAFE_USER_SELECT,
						roles: true,
						provider: { select: { id: true } },
					},
				},
			},
		});

		// Existing Google user — just issue tokens
		if (existingIdentity) {
			const user = existingIdentity.user;
			if (user.isDeleted) throw new ForbiddenException('This account has been deleted.');
			if (user.isDisabled) throw new ForbiddenException('Account is disabled.');

			await this.invalidateUserCache(user.id);
			return await this.issueSessionAndTokens(user, res);
		}

		// Check if email is already registered (with password or another method)
		const existingUser = await this.databaseService.user.findUnique({
			where: { email },
			select: {
				...SAFE_USER_SELECT,
				roles: true,
				provider: { select: { id: true } },
			},
		});

		if (existingUser) {
			// Email exists — link Google identity to existing account
			if (existingUser.isDeleted) throw new ForbiddenException('This account has been deleted.');

			await this.databaseService.authIdentity.create({
				data: {
					userId: existingUser.id,
					provider: AuthProvider.GOOGLE,
					providerId: uid,
				},
			});

			// Mark as verified since Google emails are pre-verified
			await this.databaseService.user.update({
				where: { id: existingUser.id },
				data: {
					isVerified: true,
					phoneNumber: existingUser.phoneNumber ? existingUser.phoneNumber : phone_number ?? null,
					avatarUrl: existingUser.avatarUrl ? existingUser.avatarUrl : picture ?? null,
				},
			});

			await this.invalidateUserCache(existingUser.id);

			const updatedUser = { ...existingUser, isVerified: true };
			return await this.issueSessionAndTokens(updatedUser, res);
		}

		// Brand new user — need name to create account
		// If frontend didn't send name, return isNewUser flag
		const resolvedFirstName = firstName ?? name?.split(' ')[0];
		const resolvedLastName = lastName ?? name?.split(' ').slice(1).join(' ');

		if (!resolvedFirstName) {
			// Frontend must show the modal to collect name
			return { isNewUser: true, email, googleUid: uid };
		}

		// Create new user with Google identity
		const newUser = await this.databaseService.user.create({
			data: {
				firstName: resolvedFirstName,
				lastName: resolvedLastName ?? '',
				email,
				isVerified: true, // Google accounts are pre-verified
				roles: {
					create: {
						role: this.config.get('DEFAULT_ADMIN_EMAIL') === email
							? UserRole.ADMIN
							: UserRole.USER,
					},
				},
				phoneNumber: phone_number ?? null,
				avatarUrl: picture ?? null,
				authIdentities: {
					create: {
						provider: AuthProvider.GOOGLE,
						providerId: uid,
					},
				},
			},
			select: {
				...SAFE_USER_SELECT,
				roles: true,
				provider: { select: { id: true } },
			},
		});
		await this.invalidateUserCache(newUser.id);

		const safeUser: SafeUser = { ...newUser, providerId: newUser.provider?.id };
		return await this.issueSessionAndTokens(safeUser, res);
	}
}
