import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { env } from '../../platform/config/env';
import { ACTOR_ADAPTER } from '../../platform/http/actor-adapter.port';
import { DevelopmentActorAdapter } from '../../platform/http/adapters/development-actor.adapter';
import { ActorGuard } from '../../platform/http/guards/actor.guard';
import { NestLoggerAdapter } from '../../platform/observability/nest-logger.adapter';

// Domain ports
import { PASSWORD_HASHER, type IPasswordHasher } from './domain/ports/password-hasher.port';
import { TOKEN_ISSUER, type ITokenIssuer } from './domain/ports/token-issuer.port';
import { SESSION_REPOSITORY, type ISessionRepository } from './domain/ports/session.repository.port';
import { EMAIL_VERIFICATION_REPOSITORY, type IEmailVerificationRepository } from './domain/ports/email-verification.repository.port';
import { PASSWORD_RESET_REPOSITORY, type IPasswordResetRepository } from './domain/ports/password-reset.repository.port';
import { AUTH_ATTEMPT_REPOSITORY, type IAuthAttemptRepository } from './domain/ports/auth-attempt.repository.port';
import { USER_REPOSITORY, type IUserRepository } from './domain/ports/user.repository.port';

// Infrastructure adapters
import { ArgonPasswordHasherAdapter } from './infrastructure/adapters/argon-password-hasher.adapter';
import { JwtTokenIssuerAdapter } from './infrastructure/adapters/jwt-token-issuer.adapter';
import { JwtActorAdapter } from './infrastructure/adapters/jwt-actor.adapter';

// Infrastructure repositories
import { PrismaSessionRepository } from './infrastructure/repositories/prisma-session.repository';
import { PrismaEmailVerificationRepository } from './infrastructure/repositories/prisma-email-verification.repository';
import { PrismaPasswordResetRepository } from './infrastructure/repositories/prisma-password-reset.repository';
import { PrismaAuthAttemptRepository } from './infrastructure/repositories/prisma-auth-attempt.repository';
import { PrismaUserRepository } from './infrastructure/repositories/prisma-user.repository';

// Application use cases
import { RegisterWithPasswordUseCase } from './application/use-cases/register-with-password.use-case';
import { AuthenticateWithPasswordUseCase } from './application/use-cases/authenticate-with-password.use-case';
import { RefreshSessionUseCase } from './application/use-cases/refresh-session.use-case';
import { RevokeSessionUseCase } from './application/use-cases/revoke-session.use-case';
import { RequestPasswordResetUseCase } from './application/use-cases/request-password-reset.use-case';
import { ResetPasswordUseCase } from './application/use-cases/reset-password.use-case';
import { VerifyEmailUseCase } from './application/use-cases/verify-email.use-case';
import { GetCurrentIdentityUseCase } from './application/use-cases/get-current-identity.use-case';

// Presentation
import { AuthController } from './presentation/controllers/auth.controller';

const isProduction = env.NODE_ENV === 'production';

@Module({
  imports: [
    JwtModule.register({
      secret: env.JWT_SECRET ?? 'dev-secret-not-for-production-at-all',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      signOptions: { algorithm: 'HS256', expiresIn: env.JWT_ACCESS_EXPIRY as any },
    }),
  ],
  controllers: [AuthController],
  providers: [
    // Infrastructure adapters
    ArgonPasswordHasherAdapter,
    JwtTokenIssuerAdapter,
    JwtActorAdapter,
    ...(isProduction ? [] : [DevelopmentActorAdapter]),

    // Infrastructure repositories
    PrismaSessionRepository,
    PrismaEmailVerificationRepository,
    PrismaPasswordResetRepository,
    PrismaAuthAttemptRepository,
    PrismaUserRepository,

    // Port bindings
    { provide: PASSWORD_HASHER, useExisting: ArgonPasswordHasherAdapter },
    { provide: TOKEN_ISSUER, useExisting: JwtTokenIssuerAdapter },
    { provide: SESSION_REPOSITORY, useExisting: PrismaSessionRepository },
    { provide: EMAIL_VERIFICATION_REPOSITORY, useExisting: PrismaEmailVerificationRepository },
    { provide: PASSWORD_RESET_REPOSITORY, useExisting: PrismaPasswordResetRepository },
    { provide: AUTH_ATTEMPT_REPOSITORY, useExisting: PrismaAuthAttemptRepository },
    { provide: USER_REPOSITORY, useExisting: PrismaUserRepository },

    // ACTOR_ADAPTER: JwtActorAdapter in production, DevelopmentActorAdapter in dev/test
    isProduction
      ? { provide: ACTOR_ADAPTER, useExisting: JwtActorAdapter }
      : { provide: ACTOR_ADAPTER, useExisting: DevelopmentActorAdapter },

    // ActorGuard — needed by AuthController @UseGuards(ActorGuard) decorators
    ActorGuard,

    // Application use cases — plain factories (no NestJS DI decorators in use-case layer)
    {
      provide: RegisterWithPasswordUseCase,
      useFactory: (userRepo: IUserRepository, hasher: IPasswordHasher) =>
        new RegisterWithPasswordUseCase(userRepo, hasher),
      inject: [USER_REPOSITORY, PASSWORD_HASHER],
    },
    {
      provide: AuthenticateWithPasswordUseCase,
      useFactory: (
        userRepo: IUserRepository,
        hasher: IPasswordHasher,
        sessionRepo: ISessionRepository,
        tokenIssuer: ITokenIssuer,
        authAttemptRepo: IAuthAttemptRepository,
      ) => new AuthenticateWithPasswordUseCase(userRepo, hasher, sessionRepo, tokenIssuer, authAttemptRepo),
      inject: [USER_REPOSITORY, PASSWORD_HASHER, SESSION_REPOSITORY, TOKEN_ISSUER, AUTH_ATTEMPT_REPOSITORY],
    },
    {
      provide: RefreshSessionUseCase,
      useFactory: (sessionRepo: ISessionRepository, tokenIssuer: ITokenIssuer) =>
        new RefreshSessionUseCase(sessionRepo, tokenIssuer, new NestLoggerAdapter('RefreshSessionUseCase')),
      inject: [SESSION_REPOSITORY, TOKEN_ISSUER],
    },
    {
      provide: RevokeSessionUseCase,
      useFactory: (sessionRepo: ISessionRepository) =>
        new RevokeSessionUseCase(sessionRepo),
      inject: [SESSION_REPOSITORY],
    },
    {
      provide: RequestPasswordResetUseCase,
      useFactory: (userRepo: IUserRepository, passwordResetRepo: IPasswordResetRepository) =>
        new RequestPasswordResetUseCase(userRepo, passwordResetRepo),
      inject: [USER_REPOSITORY, PASSWORD_RESET_REPOSITORY],
    },
    {
      provide: ResetPasswordUseCase,
      useFactory: (hasher: IPasswordHasher, passwordResetRepo: IPasswordResetRepository, sessionRepo: ISessionRepository) =>
        new ResetPasswordUseCase(hasher, passwordResetRepo, sessionRepo),
      inject: [PASSWORD_HASHER, PASSWORD_RESET_REPOSITORY, SESSION_REPOSITORY],
    },
    {
      provide: VerifyEmailUseCase,
      useFactory: (emailVerificationRepo: IEmailVerificationRepository) =>
        new VerifyEmailUseCase(emailVerificationRepo),
      inject: [EMAIL_VERIFICATION_REPOSITORY],
    },
    {
      provide: GetCurrentIdentityUseCase,
      useFactory: (userRepo: IUserRepository) =>
        new GetCurrentIdentityUseCase(userRepo),
      inject: [USER_REPOSITORY],
    },
  ],
  exports: [
    // Export for HttpModule and other consumers
    JwtActorAdapter,
    ...(isProduction ? [] : [DevelopmentActorAdapter]),
    ACTOR_ADAPTER,
    ActorGuard,
    TOKEN_ISSUER,
    SESSION_REPOSITORY,
  ],
})
export class IdentityModule {}
