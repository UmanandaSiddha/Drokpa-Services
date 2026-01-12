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
import * as crypto from "crypto";
import { Request, Response } from 'express';
import { RequestDto } from './dto/request.dto';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthProvider, Prisma, User, UserRole, UserRoleMap } from 'generated/prisma/client';

@Injectable()
export class AuthService {

	constructor(
		private readonly databaseService: DatabaseService,
		private readonly config: ConfigService,
		private readonly jwtService: JwtService,
		private readonly emailService: EmailService,
	) { }

	// --- Helper Functions ---

	// Verify user by token
	async validateUserByToken(token: string): Promise<User & { roles: UserRoleMap[]; providerId?: string }> {
		try {
			const secret = this.config.get<string>('ACCESS_TOKEN_SECRET');
			const payload: { id: string } = await this.jwtService.verifyAsync(token, { secret });

			const user = await this.databaseService.user.findUnique({
				where: { id: payload.id },
				include: {
					roles: true,
					provider: {
						select: {
							id: true,
						},
					},
				},
			});
			if (!user) throw new UnauthorizedException('Invalid user.');

			return {
				...user,
				providerId: user.provider?.id,
			};
		} catch (err: any) {
			if (err.name === 'TokenExpiredError') throw new UnauthorizedException('Token expired.');
			throw new UnauthorizedException('Invalid token.');
		}
	}

	// Generate JWT Token
	async generateToken(userId: string, type: "ACCESS_TOKEN" | "REFRESH_TOKEN", sessionId: string | null): Promise<string> {
		const secret = type === "ACCESS_TOKEN"
			? process.env.ACCESS_TOKEN_SECRET
			: process.env.REFRESH_TOKEN_SECRET;
		const expiresIn = type === "ACCESS_TOKEN" ? "15m" : "7d";

		const payload = type === "ACCESS_TOKEN" ? { id: userId } : { id: userId, sessionId: sessionId }

		return this.jwtService.sign(payload, { secret, expiresIn });
	}

	// Generate 6 digit OTP
	async generateOTP(): Promise<{ otpString: string, otpToken: string, otpExpire: number }> {
		let otpString: string;
		if (process.env.NODE_ENV === "production") {
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
	async sendToken(res: Response, type: "ACCESS_TOKEN" | "REFRESH_TOKEN", token: string): Promise<void> {
		const isProduction = process.env.NODE_ENV === 'production';
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
	async clearToken(res: Response, type: "ACCESS_TOKEN" | "REFRESH_TOKEN"): Promise<void> {
		const isProduction = process.env.NODE_ENV === 'production';
		const tokenName = type === "ACCESS_TOKEN" ? 'accessToken' : 'refreshToken';

		res.clearCookie(tokenName, {
			httpOnly: true,
			secure: isProduction,
			sameSite: 'lax',
			path: '/',
		});
	}

	// --- Services ---

	// Request OTP
	async requestOtp(dto: RequestDto) {
		const { email } = dto;

		const user = await this.databaseService.user.findUnique({
			where: { email }
		});
		if (!user) throw new BadRequestException('Invalid Request!!');

		const { otpString, otpToken, otpExpire } = await this.generateOTP();

		await this.databaseService.user.update({
			where: { id: user.id },
			data: {
				oneTimePassword: otpToken,
				oneTimeExpire: new Date(otpExpire),
			},
		});

		// Send OTP email (production only)
		await this.emailService.sendOtpEmail(email, otpString);

		if (process.env.NODE_ENV !== "production") {
			console.log("OTP: ", otpString);
		}

		return { message: 'OTP sent successfully!!', success: true };
	}

	async signUp(dto: SignUpDto, res: Response) {
		const { firstName, lastName, email, password } = dto;

		const user = await this.databaseService.user.findUnique({
			where: { email }
		});
		if (user) throw new BadRequestException('User already exists !!');

		const hashedPassword = await bcrypt.hash(password, 10);
		const { otpString, otpToken, otpExpire } = await this.generateOTP();

		const newUser = await this.databaseService.user.create({
			data: {
				firstName,
				lastName,
				passwordHash: hashedPassword,
				email,
				roles: {
					create: {
						role: process.env.DEFAULT_ADMIN_EMAIL === email ? UserRole.ADMIN : UserRole.USER
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
		});

		const session = await this.databaseService.session.create({
			data: {
				userId: newUser.id,
				refreshToken: "",
				expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
			},
		});

		const accessToken = await this.generateToken(newUser.id, "ACCESS_TOKEN", null);
		const refreshToken = await this.generateToken(newUser.id, "REFRESH_TOKEN", session.id);

		const hashedToken = await bcrypt.hash(refreshToken, 10);

		await this.databaseService.session.update({
			where: { id: session.id },
			data: { refreshToken: hashedToken },
		});

		const clientRefreshToken = `${session.id}.${refreshToken}`;

		await this.sendToken(res, "ACCESS_TOKEN", accessToken);
		await this.sendToken(res, "REFRESH_TOKEN", clientRefreshToken);

		// Send welcome email with OTP (production only)
		await this.emailService.sendOtpEmail(email, otpString);

		if (process.env.NODE_ENV !== "production") {
			console.log("OTP: ", otpString);
		}

		return { message: 'User registered successfully!!', data: newUser, accessToken, clientRefreshToken };
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

		const payload: Prisma.UserUpdateInput = {
			isVerified: true,
			oneTimePassword: null,
			oneTimeExpire: null,
		};

		const updatedUser = await this.databaseService.user.update({
			where: { id: user.id },
			data: payload
		});

		// Check if there's a pending onboarding invite for this email
		// If user has firstName/lastName, we can use that as provider name
		// Otherwise, onboarding will need to be completed manually
		const onboarding = await this.databaseService.onboarding.findFirst({
			where: {
				email,
				completedAt: null,
				expiresAt: { gt: new Date() },
			},
		});

		// If onboarding exists but we don't have enough info, we'll let them complete it manually
		// For now, we'll just mark that onboarding exists (they can complete via /onboarding/complete)
		let providerCreated = false;
		if (onboarding) {
			// Check if user already has provider
			const existingProvider = await this.databaseService.provider.findUnique({
				where: { userId: user.id },
			});

			if (!existingProvider) {
				// Provider will be created when user completes onboarding with name/contactNumber
				// For now, we just note that onboarding is pending
				providerCreated = false;
			} else {
				providerCreated = true;
			}
		}

		const session = await this.databaseService.session.create({
			data: {
				userId: user.id,
				refreshToken: "",
				expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
			},
		});

		const accessToken = await this.generateToken(updatedUser.id, "ACCESS_TOKEN", null);
		const refreshToken = await this.generateToken(updatedUser.id, "REFRESH_TOKEN", session.id);

		const hashedToken = await bcrypt.hash(refreshToken, 10);

		await this.databaseService.session.update({
			where: { id: session.id },
			data: { refreshToken: hashedToken },
		});

		const clientRefreshToken = `${session.id}.${refreshToken}`;

		await this.sendToken(res, "ACCESS_TOKEN", accessToken);
		await this.sendToken(res, "REFRESH_TOKEN", clientRefreshToken);

		// Return response with onboarding status
		const response: any = {
			message: 'Email verified successfully',
			user: {
				id: updatedUser.id,
				email: updatedUser.email,
				isVerified: updatedUser.isVerified,
			},
			accessToken,
			clientRefreshToken,
		};

		// If onboarding exists and provider not created, inform user they need to complete it
		if (onboarding && !providerCreated) {
			response.onboardingPending = true;
			response.onboardingToken = onboarding.token;
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
		if (!clientToken) throw new NotFoundException('Refresh token not found!!');

		const parts = clientToken.split(".");
		const sessionId = parts.shift();
		const token = parts.join(".");

		if (!sessionId || !token) throw new UnauthorizedException('Malformed token');

		const decoded = await this.jwtService.verifyAsync(token, { secret: process.env.REFRESH_TOKEN_SECRET });
		if (!decoded) throw new UnauthorizedException('Invalid refresh token!!');

		const user = await this.databaseService.user.findUnique({
			where: { id: decoded.id },
		});
		if (!user) throw new UnauthorizedException('Invalid refresh token!!');

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

		const accessToken = await this.generateToken(user.id, "ACCESS_TOKEN", null);
		await this.sendToken(res, "ACCESS_TOKEN", accessToken);

		return { message: 'User token refreshed successfully!!', accessToken };
	}

	async signIn(dto: LoginDto, res: Response) {
		const { password, email } = dto;

		const user = await this.databaseService.user.findFirst({
			where: { email },
		});
		if (!user) throw new BadRequestException('Invalid credentials!!');

		const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
		if (!isPasswordValid) throw new BadRequestException('Invalid credentials!!');

		const session = await this.databaseService.session.create({
			data: {
				userId: user.id,
				refreshToken: "",
				expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
			},
		});

		const accessToken = await this.generateToken(user.id, "ACCESS_TOKEN", null);
		const refreshToken = await this.generateToken(user.id, "REFRESH_TOKEN", session.id);

		const hashedToken = await bcrypt.hash(refreshToken, 10);

		await this.databaseService.session.update({
			where: { id: session.id },
			data: { refreshToken: hashedToken },
		});

		const clientRefreshToken = `${session.id}.${refreshToken}`;

		await this.sendToken(res, "ACCESS_TOKEN", accessToken);
		await this.sendToken(res, "REFRESH_TOKEN", clientRefreshToken);

		return { message: 'User logged in successfully!!', data: user, accessToken, clientRefreshToken };
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

		await this.clearToken(res, "ACCESS_TOKEN");
		await this.clearToken(res, "REFRESH_TOKEN");

		return { success: true, message: 'User logged out successfully!!' }
	}

	async requestPasswordReset(dto: RequestDto) {
		const { email } = dto;

		const user = await this.databaseService.user.findUnique({
			where: { email }
		});
		if (!user) {
			// Don't reveal if user exists
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
		const resetUrl = `${process.env.FRONTEND_URL || 'https://drokpa.com'}/reset-password?token=${resetToken}`;
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

	async resetPassword(token: string, newPassword: string) {
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
}
