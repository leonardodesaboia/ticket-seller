Módulo: Payments
Responsabilidade

Controlar a representação interna de cobranças, tentativas, confirmações, cancelamentos, reembolsos e eventos de provedores.

Não é responsabilidade
armazenar dados completos de cartão;
decidir estoque;
emitir ingresso diretamente;
calcular saldo contábil final;
realizar check-in.
Entidades
Payment

Representa a cobrança interna.

PaymentAttempt

Representa uma tentativa de processamento.

ProviderEvent

Representa webhook recebido.

Refund

Representa devolução total ou parcial.

Estados do pagamento
CREATED
PENDING
AUTHORIZED
PAID
FAILED
CANCELLED
PARTIALLY_REFUNDED
REFUNDED
CHARGEBACK
Estados do reembolso
REQUESTED
PROCESSING
SUCCEEDED
FAILED
CANCELLED
Casos de uso
Comandos
CreatePayment;
ProcessPaymentWebhook;
SynchronizePayment;
CancelPayment;
RequestRefund;
ProcessRefund;
MarkChargeback;
RetryUnknownPayment;
RegisterProviderAccount.
Consultas
GetPayment;
GetPaymentStatus;
ListOrderPayments;
ListProviderEvents;
GetRefund.
Invariantes
pagamento pertence a um pedido;
valor deve coincidir com o valor autorizado do pedido;
pagamento pago não pode voltar para pendente;
pagamento reembolsado não pode ser pago novamente;
reembolso total não pode superar o valor pago;
reembolsos parciais acumulados não podem ultrapassar o total;
mesmo evento externo não pode ser processado mais de uma vez;
timeout não significa falha definitiva;
estado externo deve ser traduzido para estado interno;
provider e identificador externo devem ser armazenados.
Eventos de domínio
payment.created.v1;
payment.pending.v1;
payment.authorized.v1;
payment.paid.v1;
payment.failed.v1;
payment.cancelled.v1;
payment.refund-requested.v1;
payment.refunded.v1;
payment.chargeback.v1.
Portas
PaymentRepository;
PaymentGateway;
ProviderEventRepository;
RefundRepository;
OrderPort;
LedgerPort;
IdempotencyRepository;
Clock;
IdGenerator.
Dependências permitidas
orders;
finance por evento ou porta;
audit;
antifraud;
adapters de PSP dentro da infraestrutura.
Dependências proibidas
inventory;
checkin;
SDK do PSP no domínio;
armazenamento de CVV.
Multi-tenancy

Todo pagamento é associado à organização do pedido.

Consultas usam:

organizationId + paymentId

Eventos do PSP devem ser vinculados ao tenant por dados internos confiáveis.

Segurança
validar assinatura de webhook;
preservar corpo bruto quando necessário;
nunca registrar cartão completo, CVV ou token sensível;
restringir endpoint de webhook;
utilizar idempotência;
responder rapidamente ao PSP;
processar lógica pesada em worker;
verificar valores e moeda;
registrar reembolsos administrativos.
Concorrência
webhook e sincronização manual simultâneos não podem duplicar confirmação;
dois reembolsos simultâneos não podem ultrapassar o valor disponível;
cancelamento e confirmação simultâneos devem ser conciliados;
eventos fora de ordem devem ser tratados.
Idempotência

Obrigatória em:

criação de cobrança;
cancelamento;
reembolso;
processamento de webhook;
sincronização;
registro de conta de recebedor.
Testes obrigatórios
pagamento aprovado;
pendente;
recusado;
timeout;
webhook duplicado;
assinatura inválida;
evento fora de ordem;
reembolso parcial;
reembolso total;
reembolso superior ao valor;
acesso de outra organização;
adapter passando pelo contrato comum.
Métricas
payments_created;
payments_paid;
payments_failed;
payment_approval_rate;
payment_processing_duration;
duplicate_provider_events;
refunds_requested;
refunds_failed;
payments_unknown_state.