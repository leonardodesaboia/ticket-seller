export enum OrganizationCapability {
  MEMBERS_VIEW = 'members.view',
  MEMBERS_MANAGE = 'members.manage',
  INVITATIONS_MANAGE = 'invitations.manage',
  ORGANIZATION_SETTINGS = 'organization.settings',
  EVENTS_MANAGE = 'events.manage',
  FINANCE_READ = 'finance.read',
  PAYOUT_REQUEST = 'payout.request',
  CHECKIN_PERFORM = 'checkin.perform',
  ROLES_ASSIGN = 'roles.assign',
}

export const ROLE_CAPABILITIES: Record<string, OrganizationCapability[]> = {
  OWNER: [
    OrganizationCapability.MEMBERS_VIEW,
    OrganizationCapability.MEMBERS_MANAGE,
    OrganizationCapability.INVITATIONS_MANAGE,
    OrganizationCapability.ORGANIZATION_SETTINGS,
    OrganizationCapability.EVENTS_MANAGE,
    OrganizationCapability.FINANCE_READ,
    OrganizationCapability.PAYOUT_REQUEST,
    OrganizationCapability.CHECKIN_PERFORM,
    OrganizationCapability.ROLES_ASSIGN,
  ],
  ADMIN: [
    OrganizationCapability.MEMBERS_VIEW,
    OrganizationCapability.MEMBERS_MANAGE,
    OrganizationCapability.INVITATIONS_MANAGE,
    OrganizationCapability.EVENTS_MANAGE,
    OrganizationCapability.FINANCE_READ,
    OrganizationCapability.CHECKIN_PERFORM,
  ],
  FINANCE: [
    OrganizationCapability.MEMBERS_VIEW,
    OrganizationCapability.FINANCE_READ,
    OrganizationCapability.PAYOUT_REQUEST,
  ],
  EVENT_MANAGER: [
    OrganizationCapability.MEMBERS_VIEW,
    OrganizationCapability.EVENTS_MANAGE,
    OrganizationCapability.CHECKIN_PERFORM,
  ],
  CHECK_IN_STAFF: [
    OrganizationCapability.MEMBERS_VIEW,
    OrganizationCapability.CHECKIN_PERFORM,
  ],
};

export const VALID_ORGANIZATION_ROLES = Object.keys(ROLE_CAPABILITIES) as string[];
