Módulo: Payouts
Responsabilidade

Controlar solicitação, agendamento, retenção, processamento e confirmação de repasses para produtores.

Não é responsabilidade
calcular o ledger;
processar venda;
controlar ingressos;
armazenar credenciais bancárias completas;
substituir o PSP.
Entidades
Payout

Representa um repasse.

PayoutDestination

Representa referência segura ao destino financeiro.

PayoutAttempt

Representa tentativa de execução.

Estados
SCHEDULED
HELD
PROCESSING
PAID
FAILED
CANCELLED
REVERSED
Casos de uso
Comandos
SchedulePayout;
HoldPayout;
ReleasePayout;
ProcessPayout;
RetryPayout;
CancelPayout;
MarkPayoutPaid;
ReversePayout;
UpdatePayoutDestination.
Consultas
GetPayout;
ListOrganizationPayouts;
GetPayoutSchedule;
GetPayoutDestinationStatus.
Invariantes
repasse pertence a uma organização;
valor não pode superar saldo disponível;
repasse retido não pode ser processado;
repasse pago não pode ser pago novamente;
alteração de destino exige validação reforçada;
reversão gera movimentação financeira;
evento cancelado ou de risco pode bloquear repasse;
destino deve estar validado pelo provider quando necessário.
Eventos de domínio
payout.scheduled.v1;
payout.held.v1;
payout.released.v1;
payout.processing.v1;
payout.paid.v1;
payout.failed.v1;
payout.cancelled.v1;
payout.reversed.v1;
payout.destination-updated.v1.
Portas
PayoutRepository;
PayoutGateway;
BalancePort;
RiskAssessmentPort;
ProviderAccountPort;
IdempotencyRepository;
Clock;
IdGenerator.
Dependências permitidas
finance;
payments;
antifraud;
organizations;
audit.
Dependências proibidas
inventory;
tickets;
checkin;
acesso direto a SDK fora do adapter.
Multi-tenancy

Toda consulta utiliza:

organizationId + payoutId
Segurança
alteração bancária exige MFA ou reautenticação;
notificar mudança de destino;
aplicar período de segurança quando definido;
não exibir dados bancários completos;
ações manuais devem ser auditadas;
repasses de risco devem exigir revisão.
Concorrência
duas solicitações sobre o mesmo saldo não podem ultrapassá-lo;
repasse e reembolso simultâneos devem respeitar ledger;
confirmação duplicada do provider não pode duplicar pagamento.
Idempotência

Obrigatória em:

agendamento;
processamento;
confirmação;
reversão;
atualização de destino.
Testes obrigatórios
repasse válido;
saldo insuficiente;
repasse retido;
confirmação duplicada;
falha e retry;
alteração de destino;
acesso de outra organização;
concorrência com reembolso;
organização bloqueada.
Métricas
payouts_scheduled;
payouts_paid;
payouts_failed;
payouts_held;
payout_processing_duration;
payout_amount_total;
payout_retries.