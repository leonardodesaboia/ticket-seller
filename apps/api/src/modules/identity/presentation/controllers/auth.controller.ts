import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ActorGuard } from '../../../../platform/http/guards/actor.guard';
import { CurrentActor } from '../../../../shared/kernel/current-actor.decorator';
import type { ICurrentActor } from '../../../../shared/kernel/actor.types';
import { env } from '../../../../platform/config/env';
import {
  AuthForgotThrottle,
  AuthLoginThrottle,
  AuthRefreshThrottle,
  AuthRegisterThrottle,
  AuthResetPasswordThrottle,
  AuthVerifyEmailThrottle,
} from '../../../../platform/http/decorators/throttle.decorator';
import { RegisterWithPasswordUseCase } from '../../application/use-cases/register-with-password.use-case';
import { AuthenticateWithPasswordUseCase } from '../../application/use-cases/authenticate-with-password.use-case';
import { RefreshSessionUseCase } from '../../application/use-cases/refresh-session.use-case';
import { RevokeSessionUseCase } from '../../application/use-cases/revoke-session.use-case';
import { RequestPasswordResetUseCase } from '../../application/use-cases/request-password-reset.use-case';
import { ResetPasswordUseCase } from '../../application/use-cases/reset-password.use-case';
import { VerifyEmailUseCase } from '../../application/use-cases/verify-email.use-case';
import { GetCurrentIdentityUseCase } from '../../application/use-cases/get-current-identity.use-case';
import { RegisterDto } from '../dtos/register.dto';
import { LoginDto } from '../dtos/login.dto';
import { ForgotPasswordDto } from '../dtos/forgot-password.dto';
import { ResetPasswordDto } from '../dtos/reset-password.dto';
import { VerifyEmailDto } from '../dtos/verify-email.dto';

const REFRESH_TOKEN_COOKIE = 'refresh_token';
const REFRESH_TOKEN_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUseCase: RegisterWithPasswordUseCase,
    private readonly authenticateUseCase: AuthenticateWithPasswordUseCase,
    private readonly refreshSessionUseCase: RefreshSessionUseCase,
    private readonly revokeSessionUseCase: RevokeSessionUseCase,
    private readonly requestPasswordResetUseCase: RequestPasswordResetUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
    private readonly verifyEmailUseCase: VerifyEmailUseCase,
    private readonly getCurrentIdentityUseCase: GetCurrentIdentityUseCase,
  ) {}

  @Post('register')
  @HttpCode(201)
  @AuthRegisterThrottle()
  @ApiOperation({ summary: 'Register with email and password' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async register(@Body() dto: RegisterDto): Promise<{ userId: string }> {
    const result = await this.registerUseCase.execute({
      email: dto.email,
      password: dto.password,
      displayName: dto.displayName,
    });
    return { userId: result.userId };
  }

  @Post('login')
  @HttpCode(200)
  @AuthLoginThrottle()
  @ApiOperation({ summary: 'Authenticate with email and password' })
  @ApiResponse({ status: 200, description: 'Authenticated successfully' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 429, description: 'Too many attempts' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<{ accessToken: string; user: { id: string; email: string; displayName: string | null } }> {
    const ip = (req.ip as string | undefined) ?? '0.0.0.0';
    const userAgent = req.headers['user-agent'];

    const result = await this.authenticateUseCase.execute({
      email: dto.email,
      password: dto.password,
      ip,
      userAgent,
    });

    this.setRefreshTokenCookie(reply, result.refreshToken);

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Post('refresh')
  @HttpCode(200)
  @AuthRefreshThrottle()
  @ApiOperation({ summary: 'Refresh access token using refresh token cookie' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<{ accessToken: string }> {
    const refreshToken = this.extractRefreshTokenFromCookieHeader(req);
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token missing');
    }

    const result = await this.refreshSessionUseCase.execute({ refreshToken });

    this.setRefreshTokenCookie(reply, result.refreshToken);

    return { accessToken: result.accessToken };
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(ActorGuard)
  @ApiOperation({ summary: 'Revoke current session' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(
    @CurrentActor() actor: ICurrentActor,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    if (actor.sessionId) {
      await this.revokeSessionUseCase.execute({ sessionId: actor.sessionId });
    }
    this.clearRefreshTokenCookie(reply);
  }

  @Post('forgot-password')
  @HttpCode(200)
  @AuthForgotThrottle()
  @ApiOperation({ summary: 'Request a password reset email' })
  @ApiResponse({ status: 200, description: 'If email exists, a reset link was sent' })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<void> {
    await this.requestPasswordResetUseCase.execute({ email: dto.email });
  }

  @Post('reset-password')
  @HttpCode(200)
  @AuthResetPasswordThrottle()
  @ApiOperation({ summary: 'Reset password using a reset token' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.resetPasswordUseCase.execute({
      token: dto.token,
      newPassword: dto.newPassword,
    });
  }

  @Post('verify-email')
  @HttpCode(200)
  @AuthVerifyEmailThrottle()
  @ApiOperation({ summary: 'Verify email address using a verification token' })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<void> {
    await this.verifyEmailUseCase.execute({ token: dto.token });
  }

  @Get('me')
  @UseGuards(ActorGuard)
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiResponse({ status: 200, description: 'Current user data' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  async me(
    @CurrentActor() actor: ICurrentActor,
  ): Promise<{
    id: string;
    email: string;
    displayName: string | null;
    emailVerified: boolean;
    locale: string;
    timezone: string;
  }> {
    return this.getCurrentIdentityUseCase.execute({ userId: actor.userId });
  }

  private extractRefreshTokenFromCookieHeader(req: FastifyRequest): string | undefined {
    const cookieHeader = req.headers['cookie'];
    if (!cookieHeader) return undefined;
    const cookies = cookieHeader.split(';').map((c) => c.trim());
    for (const cookie of cookies) {
      const [name, ...valueParts] = cookie.split('=');
      if (name?.trim() === REFRESH_TOKEN_COOKIE) {
        return valueParts.join('=');
      }
    }
    return undefined;
  }

  private setRefreshTokenCookie(reply: FastifyReply, token: string): void {
    const isProduction = env.NODE_ENV === 'production';
    const secure = isProduction ? '; Secure' : '';
    const cookieValue = [
      `${REFRESH_TOKEN_COOKIE}=${token}`,
      'HttpOnly',
      `Max-Age=${REFRESH_TOKEN_MAX_AGE}`,
      'Path=/api/v1/auth',
      'SameSite=Strict',
      secure,
    ]
      .filter(Boolean)
      .join('; ');
    reply.header('Set-Cookie', cookieValue);
  }

  private clearRefreshTokenCookie(reply: FastifyReply): void {
    const isProduction = env.NODE_ENV === 'production';
    const secure = isProduction ? '; Secure' : '';
    const cookieValue = [
      `${REFRESH_TOKEN_COOKIE}=`,
      'HttpOnly',
      'Max-Age=0',
      'Path=/api/v1/auth',
      'SameSite=Strict',
      secure,
    ]
      .filter(Boolean)
      .join('; ');
    reply.header('Set-Cookie', cookieValue);
  }
}
