export const FINANCE_TRANSACTION_RUNNER = Symbol('IFinanceTransactionRunner');

export interface IFinanceTransactionRunner {
  run<T>(work: (tx: unknown) => Promise<T>): Promise<T>;
}
