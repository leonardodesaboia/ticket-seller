Módulo: Inventory
Responsabilidade

Controlar disponibilidade, reserva, confirmação e liberação de estoque de ingressos.

Não é responsabilidade
criar pedidos;
processar pagamentos;
emitir ingressos;
realizar check-in.
Entidades
TicketInventory

Representa a quantidade disponível de um tipo de ingresso em um lote ou sessão.

Reservation

Representa o bloqueio temporário de uma quantidade.

Casos de uso
Comandos
TryReserveInventory;
ConfirmReservation;
ReleaseReservation;
ReleaseExpiredReservations.
Consultas
GetInventoryAvailability;
GetReservation.
Invariantes
quantidade disponível nunca pode ficar negativa;
quantidade reservada e vendida não pode superar o total;
reserva expirada não pode ser confirmada;
confirmação não pode ocorrer duas vezes;
liberação repetida não altera o estoque novamente;
PostgreSQL é a fonte oficial.
Estados da reserva
ACTIVE
CONFIRMED
EXPIRED
RELEASED
CANCELLED
Eventos
inventory.reserved.v1;
inventory.reservation-confirmed.v1;
inventory.reservation-released.v1;
inventory.reservation-expired.v1.
Portas
InventoryRepository;
ReservationRepository;
Clock;
IdGenerator.
Dependências permitidas
contratos comuns;
observabilidade;
banco por adapter.
Dependências proibidas
payments;
tickets;
SDK de PSP;
controller de orders.
Multi-tenancy

Toda operação recebe organizationId.

A consulta deve utilizar ao menos:

organizationId + inventoryId
Concorrência

Testar múltiplas requisições disputando o último ingresso.

Idempotência

Confirmar ou liberar a mesma reserva repetidamente não pode duplicar efeitos.

Testes obrigatórios
100 tentativas disputando 1 unidade;
reserva expirada;
confirmação duplicada;
liberação duplicada;
tentativa de acesso de outra organização;
quantidade inválida.