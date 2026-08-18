import { FeePolicy } from '../entities/fee-policy.entity';

export const FEE_POLICY_REPOSITORY = Symbol('FEE_POLICY_REPOSITORY');

export interface IFeePolicyRepository {
  /**
   * Find the active fee policy for a given organization, falling back to the
   * global policy (organization_id IS NULL) if no org-specific policy exists.
   *
   * @param organizationId - Optional organization ID. When omitted, returns the global policy.
   */
  findActive(organizationId?: string): Promise<FeePolicy | null>;
}
