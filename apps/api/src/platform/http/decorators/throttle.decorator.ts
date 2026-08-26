import { applyDecorators, SetMetadata } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';

export { SkipThrottle };

export const THROTTLE_USE_EMAIL_KEY = 'throttle:use_email_body';

const UseEmailKey = () => SetMetadata(THROTTLE_USE_EMAIL_KEY, true);

export const AuthLoginThrottle = () =>
  applyDecorators(UseEmailKey(), Throttle({ global: { limit: 5, ttl: 900_000 } }));

export const AuthForgotThrottle = () =>
  applyDecorators(UseEmailKey(), Throttle({ global: { limit: 3, ttl: 3_600_000 } }));

export const AuthRegisterThrottle = () => Throttle({ global: { limit: 10, ttl: 3_600_000 } });

export const AuthRefreshThrottle = () => Throttle({ global: { limit: 20, ttl: 300_000 } });

export const AuthResetPasswordThrottle = () => Throttle({ global: { limit: 5, ttl: 3_600_000 } });

export const AuthVerifyEmailThrottle = () => Throttle({ global: { limit: 10, ttl: 3_600_000 } });

export const InvitationThrottle = () => Throttle({ global: { limit: 10, ttl: 3_600_000 } });

export const ReservationThrottle = () => Throttle({ global: { limit: 20, ttl: 60_000 } });

export const PaymentThrottle = () => Throttle({ global: { limit: 10, ttl: 300_000 } });

export const AdminReadThrottle = () => Throttle({ global: { limit: 60, ttl: 60_000 } });

export const AdminActionThrottle = () => Throttle({ global: { limit: 10, ttl: 60_000 } });

export const TransferAcceptThrottle = () => Throttle({ global: { limit: 10, ttl: 3_600_000 } });
