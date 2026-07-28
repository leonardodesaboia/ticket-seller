Módulo: Finance
Responsabilidade

Controlar ledger interno, contas financeiras, saldos derivados, taxas, retenções, ajustes e conciliação.

Não é responsabilidade
executar pagamento no PSP;
criar pedido;
controlar estoque;
emitir ingresso;
realizar transferência bancária diretamente.
Entidades
LedgerAccount

Representa conta contábil interna.

LedgerEntry

Representa lançamento imutável.

FinancialTransaction

Agrupa lançamentos relacionados.

FinancialAdjustment

Representa ajuste administrativo controlado.

Tipos de saldo
PENDING
HELD
AVAILABLE
PROCESSING
PAID
NEGATIVE
Casos de uso
Comandos
RecordSale;
RecordPlatformFee;
RecordProcessingFee;
RecordRefund;
RecordChargeback;
HoldBalance;
ReleaseBalance;
CreateFinancialAdjustment;
ReconcilePayment;
CloseFinancialPeriod.
Consultas
GetOrganizationBalance;
GetEventFinancialSummary;
ListLedgerEntries;
GetFinancialTransaction;
GetReconciliationStatus.
Invariantes
lançamentos são imutáveis;
soma dos débitos e créditos deve fechar;
saldo é derivado dos lançamentos;
ajuste gera novos lançamentos;
reembolso e chargeback devem possuir contrapartida;
mesmo evento financeiro não pode gerar lançamentos duplicados;
moeda deve ser consistente na transação;
saldo disponível não pode ignorar retenções;
reconciliação não pode alterar histórico silenciosamente.
Eventos de domínio
finance.sale-recorded.v1;
finance.fee-recorded.v1;
finance.refund-recorded.v1;
finance.chargeback-recorded.v1;
finance.balance-held.v1;
finance.balance-released.v1;
finance.adjustment-created.v1;
finance.reconciled.v1.
Portas
LedgerRepository;
FinancialTransactionRepository;
PaymentDataPort;
PayoutPort;
IdempotencyRepository;
Clock;
IdGenerator.
Dependências permitidas
payments;
orders;
payouts;
audit;
administration para ajustes autorizados.
Dependências proibidas
inventory;
checkin;
tickets;
SDK de PSP diretamente.
Multi-tenancy

Toda conta financeira de produtor pertence a uma organização.

Consultas usam:

organizationId + accountId

Contas da plataforma possuem escopo específico e acesso administrativo restrito.

Segurança
acesso financeiro exige papel específico;
ajustes exigem autorização reforçada;
dados exportados devem ser protegidos;
toda ação administrativa deve ser auditada;
não expor dados bancários completos;
relatórios devem respeitar tenant.
Concorrência
dois eventos financeiros iguais não podem duplicar lançamento;
reembolso e repasse simultâneos devem respeitar saldo;
retenção e liberação concorrentes devem ser serializadas adequadamente.
Idempotência

Obrigatória para todo registro de evento financeiro.

Chave deve considerar origem e identificador do evento.

Testes obrigatórios
venda;
taxa;
reembolso parcial;
chargeback;
lançamentos balanceados;
evento duplicado;
ajuste administrativo;
acesso de outra organização;
cálculo de saldos;
concorrência entre repasse e reembolso.
Métricas
ledger_entries_created;
ledger_unbalanced_errors;
organization_available_balance;
organization_held_balance;
financial_adjustments;
reconciliation_failures;
negative_balances.