import { SetMetadata } from '@nestjs/common';
import type { PlatformRole } from '../../../shared/kernel/platform-role';

export const REQUIRE_PLATFORM_ROLE_KEY = 'requirePlatformRole';

export const RequirePlatformRole = (role: PlatformRole) =>
  SetMetadata(REQUIRE_PLATFORM_ROLE_KEY, role);
