Módulo: Venues
Responsabilidade

Controlar locais físicos ou virtuais utilizados por eventos.

Não é responsabilidade
gerir sessões;
gerir capacidade comercial;
controlar estoque;
vender ingressos;
integrar mapas como regra de domínio.
Entidades
Venue

Representa um local físico ou virtual.

VenueAddress

Representa endereço normalizado.

Tipos
PHYSICAL
ONLINE
HYBRID
Casos de uso
Comandos
CreateVenue;
UpdateVenue;
ArchiveVenue;
ReactivateVenue.
Consultas
GetVenue;
ListOrganizationVenues;
GetPublicVenue.
Invariantes
local pertence a uma organização;
local físico deve possuir endereço mínimo;
local online não deve exigir endereço físico;
local arquivado não pode ser associado a nova sessão;
capacidade informativa não substitui inventário;
dados de acesso privado a evento online não devem ser públicos.
Estados
ACTIVE
ARCHIVED
Eventos de domínio
venue.created.v1;
venue.updated.v1;
venue.archived.v1;
venue.reactivated.v1.
Portas
VenueRepository;
AddressNormalizer;
GeocodingProvider;
Clock;
IdGenerator.
Dependências permitidas
organizations;
audit;
provider de geocodificação por adapter.
Dependências proibidas
inventory;
orders;
payments;
tickets.
Multi-tenancy

Toda consulta administrativa usa:

organizationId + venueId
Segurança
dados privados de acesso online devem ser protegidos;
não expor instruções internas de segurança;
sanitizar campos livres;
integração de geocodificação deve possuir timeout e proteção contra abuso.
Concorrência

Atualizações simultâneas devem evitar perda de dados.

Idempotência
arquivamento repetido é seguro;
reativação repetida é segura;
criação idempotente evita duplicação em retry.
Testes obrigatórios
local físico sem endereço;
local online;
acesso de outra organização;
local arquivado;
atualização concorrente;
resposta pública sem dados privados.
Métricas
venues_total;
venues_active;
venues_archived;
geocoding_requests;
geocoding_failures.