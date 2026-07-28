Módulo: Administration
Responsabilidade

Fornecer operações administrativas da plataforma, moderação, bloqueios, suporte operacional e gestão de configurações globais.

Não é responsabilidade
substituir módulos de negócio;
editar dados financeiros sem lançamento;
alterar estoque diretamente;
executar ações sem auditoria;
fornecer acesso irrestrito ao banco.
Entidades
AdministrativeCase

Representa caso operacional ou de suporte.

PlatformRestriction

Representa bloqueio ou limitação.

AdministrativeAction

Representa ação administrativa controlada.

PlatformConfiguration

Representa configuração global versionada.

Casos de uso
Comandos
OpenAdministrativeCase;
AssignAdministrativeCase;
ResolveAdministrativeCase;
SuspendOrganization;
BlockEvent;
BlockTicket;
HoldPayout;
CreateFinancialAdjustmentRequest;
UpdatePlatformConfiguration;
ImpersonateUserForSupport;
EndImpersonation.
Consultas
GetAdministrativeCase;
ListPendingCases;
GetPlatformHealthSummary;
GetOrganizationAdministrativeView;
ListRestrictions;
GetPlatformConfiguration.
Invariantes
toda ação administrativa deve possuir ator e motivo;
ações destrutivas exigem confirmação;
alteração financeira deve passar pelo finance;
bloqueio de ingresso deve passar pelo tickets;
retenção deve passar pelo payouts;
impersonação deve ser temporária e auditada;
administrador não deve acessar dados sem finalidade;
configuração global deve possuir versão;
ações críticas podem exigir dupla aprovação.
Eventos de domínio
administration.case-opened.v1;
administration.case-resolved.v1;
administration.organization-suspended.v1;
administration.event-blocked.v1;
administration.payout-held.v1;
administration.impersonation-started.v1;
administration.impersonation-ended.v1;
administration.configuration-updated.v1.
Portas
AdministrativeCaseRepository;
OrganizationAdministrationPort;
EventAdministrationPort;
TicketAdministrationPort;
PayoutAdministrationPort;
FinanceAdministrationPort;
AuditPort;
Clock;
IdGenerator.
Dependências permitidas
organizations;
events;
tickets;
payouts;
finance;
audit;
antifraud;
notifications.
Dependências proibidas
alteração direta em tabelas de outros módulos;
SDK de PSP;
bypass silencioso de autorização.
Multi-tenancy

Administração da plataforma pode atuar entre tenants apenas com papel global adequado.

Toda ação deve registrar a organização afetada.

Administradores de organização não recebem permissões globais.

Segurança
MFA obrigatório;
princípio de menor privilégio;
impersonação claramente sinalizada;
impedir ações financeiras durante impersonação, salvo regra explícita;
registrar motivo e ticket de suporte;
dupla aprovação para ações de alto risco;
sessões administrativas curtas;
acesso por rede ou política reforçada quando possível.
Concorrência
duas ações administrativas conflitantes devem ser serializadas;
bloqueio e desbloqueio simultâneos devem ter resultado determinístico;
caso atribuído não pode ser processado por múltiplos agentes sem controle.
Idempotência
bloqueios repetidos são seguros;
retenções repetidas não duplicam efeito;
mesma ação administrativa com mesma chave não deve ser aplicada novamente.
Testes obrigatórios
administrador autorizado;
usuário comum recusado;
ação sem motivo;
ação em outra organização;
bloqueio;
retenção;
ajuste financeiro por porta;
impersonação;
dupla aprovação;
auditoria obrigatória;
ação concorrente.
Métricas
administrative_cases_open;
administrative_cases_resolved;
administrative_actions_total;
administrative_action_failures;
organizations_suspended;
events_blocked;
impersonation_sessions_active;
high_risk_actions_pending_approval;