import { SetMetadata } from '@nestjs/common';
import type { OrganizationCapability } from '../../../shared/kernel/organization-capability';

export const REQUIRE_CAPABILITY_KEY = 'requireCapability';

export const RequireCapability = (capability: OrganizationCapability) =>
  SetMetadata(REQUIRE_CAPABILITY_KEY, capability);
