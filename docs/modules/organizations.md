Módulo: Organizations
Responsabilidade

Controlar tenants, membros, papéis, convites e permissões organizacionais.

Não é responsabilidade
autenticar usuários;
criar eventos;
processar pagamentos;
calcular saldo;
executar check-in.
Entidades
Organization

Representa um produtor, empresa, associação ou grupo responsável por eventos.

OrganizationMember

Vincula um usuário a uma organização.

OrganizationInvitation

Representa convite pendente.

Role

Define conjunto de permissões.

Papéis iniciais
OWNER
ADMIN
EVENT_MANAGER
FINANCIAL_MANAGER
MARKETING
CHECKIN_SUPERVISOR
CHECKIN_OPERATOR
SUPPORT
VIEWER
Casos de uso
Comandos
CreateOrganization;
UpdateOrganization;
InviteOrganizationMember;
AcceptOrganizationInvitation;
CancelOrganizationInvitation;
ChangeMemberRole;
RemoveOrganizationMember;
TransferOrganizationOwnership;
SuspendOrganization;
ReactivateOrganization.
Consultas
GetOrganization;
ListUserOrganizations;
ListOrganizationMembers;
GetOrganizationPermissions;
ListPendingInvitations.
Invariantes
toda organização deve possuir um proprietário;
organização ativa deve possuir pelo menos um OWNER;
proprietário não pode remover a si mesmo sem transferir a propriedade;
convite expirado não pode ser aceito;
convite aceito não pode ser aceito novamente;
membro removido não pode continuar utilizando permissões da organização;
uma organização suspensa não pode publicar novos eventos ou receber novas vendas;
alteração de papel exige permissão superior adequada.
Estados da organização
PENDING_VERIFICATION
ACTIVE
SUSPENDED
BLOCKED
CLOSED
Estados do convite
PENDING
ACCEPTED
EXPIRED
CANCELLED
Eventos de domínio
organization.created.v1;
organization.member-invited.v1;
organization.member-joined.v1;
organization.member-removed.v1;
organization.member-role-changed.v1;
organization.ownership-transferred.v1;
organization.suspended.v1.
Portas
OrganizationRepository;
OrganizationMemberRepository;
OrganizationInvitationRepository;
PermissionEvaluator;
InvitationSender;
Clock;
IdGenerator.
Dependências permitidas
users;
identity;
audit;
notifications por evento;
administration para bloqueios.
Dependências proibidas
payments;
inventory;
tickets;
detalhes de eventos.
Multi-tenancy

Este módulo define o tenant.

Recursos de outros módulos devem utilizar organizationId.

A existência de um usuário não implica acesso a qualquer organização.

Segurança
verificar papel e ação em toda alteração;
exigir autenticação reforçada para transferência de propriedade;
registrar alterações de membros e permissões;
não permitir escalonamento de privilégio;
convite deve usar token aleatório e expirável;
respostas não devem expor organizações de que o usuário não participa.
Concorrência
duas transferências simultâneas de propriedade devem produzir apenas uma;
remoção e alteração de papel simultâneas devem ter resultado determinístico;
aceite simultâneo do mesmo convite deve criar apenas um vínculo.
Idempotência
aceite repetido de convite já aceito retorna resultado equivalente;
remoção repetida de membro é segura;
suspensão repetida não duplica eventos.
Testes obrigatórios
criação de organização;
transferência de propriedade;
tentativa de remover último proprietário;
convite expirado;
convite duplicado;
escalonamento de privilégio;
acesso de usuário não membro;
organização suspensa;
aceite concorrente de convite.
Métricas
organizations_total;
organizations_active;
organization_members_total;
organization_invitations_pending;
organization_permission_denials.