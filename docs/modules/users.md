Módulo: Users
Responsabilidade

Controlar o perfil global do usuário e suas informações pessoais básicas.

Não é responsabilidade
autenticação;
permissões organizacionais;
participantes de ingressos;
dados bancários;
informações de cartão.
Entidades
User

Representa a pessoa que utiliza a plataforma.

UserProfile

Armazena informações complementares.

Casos de uso
Comandos
CreateUser;
UpdateUserProfile;
UpdateUserContact;
RequestUserDeletion;
CancelUserDeletion;
AnonymizeUser;
UpdateUserPreferences.
Consultas
GetUserProfile;
GetCurrentUser;
GetUserPreferences.
Invariantes
usuário global possui identificador único;
e-mail de autenticação pertence ao módulo de identidade;
exclusão não pode apagar registros financeiros ou de auditoria obrigatórios;
anonimização deve preservar integridade referencial;
dados pessoais não devem ser duplicados sem necessidade;
preferências de marketing devem ser separadas de comunicações transacionais.
Estados
ACTIVE
DELETION_REQUESTED
ANONYMIZED
BLOCKED
Eventos de domínio
user.created.v1;
user.profile-updated.v1;
user.deletion-requested.v1;
user.anonymized.v1;
user.preferences-updated.v1.
Portas
UserRepository;
UserProfileRepository;
PersonalDataAnonymizer;
Clock;
IdGenerator.
Dependências permitidas
identity;
organizations;
audit;
notifications.
Dependências proibidas
payments;
finance;
inventory;
SDK de identidade diretamente no domínio.
Multi-tenancy

Usuários são globais.

Dados de perfil não pertencem a uma organização.

Acesso a dados do usuário deve respeitar finalidade e autorização.

Segurança
minimizar dados coletados;
mascarar dados em respostas administrativas;
restringir consulta por identificadores;
registrar acesso administrativo relevante;
não expor CPF, telefone ou endereço sem necessidade;
separar consentimento de marketing.
Concorrência

Atualizações simultâneas devem utilizar controle de versão ou estratégia equivalente quando houver risco de perda de dados.

Idempotência
pedido repetido de exclusão não duplica operações;
anonimização repetida deve ser segura;
atualização com mesma versão pode retornar resultado equivalente.
Testes obrigatórios
atualização de perfil;
acesso indevido a perfil de terceiro;
anonimização;
preservação de registros obrigatórios;
separação entre marketing e comunicação transacional;
atualização concorrente.
Métricas
users_total;
users_active;
user_deletion_requests;
users_anonymized;
user_profile_updates.