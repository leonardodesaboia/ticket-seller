export const ORDER_SETTLEMENT_QUERY_PORT = Symbol('IOrderSettlementQueryPort');

export interface IOrderSettlementQueryPort {
  isOrderSettled(orderId: string, tx?: unknown): Promise<boolean>;
}
