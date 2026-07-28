Domínio
Organização

Tenant responsável por eventos, equipe, pedidos, ingressos e informações financeiras.

Todo recurso pertencente a um produtor deve estar vinculado a uma organização.

Evento

Representa uma experiência divulgada e comercializada pela plataforma.

Estados iniciais:

DRAFT
PUBLISHED
PAUSED
CANCELLED
COMPLETED
Sessão

Ocorrência do evento em uma data e horário.

O MVP pode iniciar com uma sessão por evento, mas o modelo deve permitir múltiplas sessões futuramente.

Tipo de ingresso

Define a categoria comercial do ingresso.

Exemplos:

pista;
VIP;
inteira;
meia-entrada;
cortesia.
Lote

Define quantidade, período e preço de venda.

A virada pode ocorrer futuramente por:

quantidade;
data;
ação manual.
Inventário

Controla:

quantidade total;
quantidade reservada;
quantidade vendida;
disponibilidade.

Invariante:

total >= reserved + sold
Reserva

Bloqueio temporário de determinada quantidade de ingressos.

Estados:

ACTIVE
CONFIRMED
EXPIRED
RELEASED
CANCELLED

Regras:

possui data de expiração;
não pode ser confirmada duas vezes;
reserva expirada não pode ser confirmada;
liberação repetida não duplica estoque;
PostgreSQL é a fonte oficial.
Pedido

Agrupa itens que o comprador pretende adquirir.

Estados iniciais:

CREATED
RESERVED
PAYMENT_PENDING
PAID
TICKETS_ISSUED
CANCELLED
PARTIALLY_REFUNDED
REFUNDED
CHARGEBACK

Transições inválidas devem ser recusadas.

Pagamento

Representação interna da operação financeira.

Estados internos:

CREATED
PENDING
AUTHORIZED
PAID
FAILED
CANCELLED
PARTIALLY_REFUNDED
REFUNDED
CHARGEBACK

Status externos devem ser mapeados para esses estados.

Ingresso

Direito individual de acesso a um evento ou sessão.

Estados:

PENDING
ACTIVE
TRANSFER_PENDING
TRANSFERRED
CHECKED_IN
BLOCKED
CANCELLED
REFUNDED

Regras:

ingresso utilizado não pode ser transferido;
ingresso cancelado não pode ser utilizado;
somente um check-in pode ser confirmado;
código público não deve ser sequencial ou previsível.
Check-in

Registro da utilização do ingresso.

Deve armazenar:

ingresso;
evento;
organização;
operador;
dispositivo;
data;
origem online ou offline;
identificador de idempotência.
Pagamento simulado

O MVP utilizará inicialmente um FakePaymentGateway.

Deve permitir:

aprovação;
pendência;
recusa;
cancelamento;
reembolso;
timeout;
webhook duplicado.
Idempotência

Operações repetidas com a mesma chave não podem duplicar efeitos.

Aplicável a:

pedido;
cobrança;
pagamento;
reembolso;
ingresso;
transferência;
check-in;
repasse.
Auditoria

Operações relevantes devem registrar:

autor;
organização;
ação;
recurso;
resultado;
data;
request ID;
dados mínimos necessários.

Auditoria não deve armazenar secrets ou dados sensíveis completos.