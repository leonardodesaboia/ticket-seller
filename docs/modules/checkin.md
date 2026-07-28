Módulo: Check-in
Responsabilidade

Validar a entrada de participantes e registrar a utilização de ingressos.

Não é responsabilidade
emitir ingresso;
transferir ingresso;
receber pagamento;
controlar estoque de venda;
gerar repasse.
Entidades
CheckIn

Representa a utilização confirmada de um ingresso.

CheckInDevice

Representa dispositivo autorizado.

CheckInConflict

Representa conflito identificado em sincronização ou concorrência.

Casos de uso
Comandos
ValidateTicket;
PerformCheckIn;
UndoCheckIn;
RegisterCheckInDevice;
RevokeCheckInDevice;
SynchronizeOfflineCheckIns;
ResolveCheckInConflict.
Consultas
GetCheckIn;
SearchEventAttendee;
GetEventCheckInSummary;
ListDeviceCheckIns;
ListCheckInConflicts.
Resultado de validação
VALID
ALREADY_CHECKED_IN
BLOCKED
CANCELLED
REFUNDED
WRONG_EVENT
INVALID_CODE
EXPIRED
TRANSFER_PENDING
Invariantes
apenas ingresso ativo pode entrar;
ingresso só pode ter um check-in confirmado;
check-in deve pertencer ao evento correto;
operador deve possuir acesso ao evento;
check-in desfeito exige permissão superior;
check-in desfeito deve manter histórico;
código inválido não pode revelar dados;
sincronização offline não pode apagar conflitos;
primeiro check-in confirmado prevalece conforme regra definida.
Eventos de domínio
checkin.performed.v1;
checkin.rejected.v1;
checkin.undone.v1;
checkin.device-registered.v1;
checkin.device-revoked.v1;
checkin.conflict-detected.v1;
checkin.conflict-resolved.v1.
Portas
CheckInRepository;
TicketValidationPort;
DeviceRepository;
OperatorAuthorizationPort;
OfflineSyncRepository;
Clock;
IdGenerator;
IdempotencyRepository.
Dependências permitidas
tickets;
events;
organizations;
audit;
observabilidade.
Dependências proibidas
payments;
finance;
inventory;
notifications síncronas.
Multi-tenancy

Toda operação utiliza:

organizationId + eventId

Operador só pode atuar nos eventos autorizados.

Segurança
dispositivo deve possuir credencial revogável;
código do ingresso não deve ser logado integralmente;
busca manual deve possuir rate limiting;
respostas rejeitadas não devem expor dados pessoais;
desfazer check-in deve ser auditado;
modo offline deve utilizar pacote assinado.
Concorrência
duas leituras simultâneas do mesmo ingresso devem gerar apenas um check-in;
cancelamento e check-in simultâneos devem ter resultado determinístico;
sincronização de dispositivos offline pode gerar conflito explícito;
operação crítica deve utilizar atualização atômica ou constraint.
Idempotência
mesma leitura com mesma chave retorna resultado equivalente;
sincronização repetida não duplica check-ins;
desfazer repetido não altera histórico mais de uma vez.
Testes obrigatórios
ingresso válido;
leitura duplicada;
código inválido;
ingresso de outro evento;
ingresso bloqueado;
operador sem acesso;
duas leituras simultâneas;
cancelamento concorrente;
sincronização repetida;
desfazer com e sem permissão.
Métricas
checkins_performed;
checkins_rejected;
checkin_duration_ms;
duplicate_checkins;
checkin_conflicts;
checkin_devices_active;
checkin_searches;