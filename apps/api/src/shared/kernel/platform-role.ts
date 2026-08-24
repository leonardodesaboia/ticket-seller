export enum PlatformRole {
  PLATFORM_SUPPORT = 'PLATFORM_SUPPORT',
  PLATFORM_ADMIN = 'PLATFORM_ADMIN',
}

/** Numeric hierarchy: higher means more privilege */
export const PLATFORM_ROLE_HIERARCHY: Record<PlatformRole, number> = {
  [PlatformRole.PLATFORM_SUPPORT]: 1,
  [PlatformRole.PLATFORM_ADMIN]: 2,
};
