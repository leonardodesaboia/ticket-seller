export const SETTLEMENT_POLICY_PORT = Symbol('SETTLEMENT_POLICY_PORT');

export interface ISettlementPolicyPort {
  getDelayDays(organizationId: string): Promise<number>;
}
