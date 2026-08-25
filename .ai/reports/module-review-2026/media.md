# Revisão de Módulo — media

**Data:** 2026-08-25
**Revisor:** Claude Sonnet 4.6 (análise automatizada)
**Status:** Documentado — correções pendentes

---

## Resumo Executivo

O módulo `media` tem bom design geral: IDOR prevenido com filtro `organizationId` + `eventId`, validação de content-type no lado do servidor via `headObject`, e deleção do objeto ao exceder tamanho. Os riscos mais sérios envolvem a **ausência de guard no endpoint GET** (URL pré-assinada exposta sem autenticação), a **falta de atomicidade entre `mediaUploadRepo.update` e `prisma.event.update`**, e a **violação arquitetural** com `PrismaService` injetado diretamente em todos os use cases. Foram identificados **2 bloqueantes**, **4 altos**, **4 médios** e **3 baixos**.

---

## Problemas por Severidade

### BLOQUEANTE

#### BL1 — `event-cover.controller.ts`: Endpoint GET sem autenticação — URL pré-assinada exposta publicamente

**Classificação:** BLOQUEANTE
**Arquivo:** `apps/api/src/modules/media/presentation/controllers/event-cover.controller.ts`
**Trecho:** handler `getCover` (GET `/organizations/:orgId/events/:eventId/cover`)
**Problema:** O endpoint `GET` não tem nenhum guard de autenticação (`ActorGuard`) nem de autorização (`OrganizationRoleGuard`). Qualquer pessoa não autenticada pode acessar a URL pré-assinada de download do cover de qualquer evento.
**Impacto:** Exposição de URLs pré-assinadas de objetos privados a usuários não autenticados. Se o bucket for privado (comportamento correto de produção), as URLs geradas têm validade de 1 hora e qualquer pessoa com o UUID do evento pode obtê-las.
**Correção recomendada:** Adicionar `@UseGuards(ActorGuard, OrganizationRoleGuard)` e `@RequireCapability(OrganizationCapability.EVENTS_VIEW)` ao endpoint `GET`.

---

#### BL2 — Violação de arquitetura hexagonal: todos os use cases injetam `PrismaService` diretamente

**Classificação:** BLOQUEANTE
**Arquivo:** `apps/api/src/modules/media/application/use-cases/generate-event-cover-upload-url.use-case.ts`, `confirm-event-cover-upload.use-case.ts`, `get-event-cover-url.use-case.ts`
**Trecho:** construtores dos três use cases
**Problema:** Todos os use cases do módulo injetam `PrismaService` na camada de aplicação. Viola ports & adapters, acopla use cases à implementação Prisma e é inconsistente com a correção já feita nos módulos `identity` e `platform-admin`.
**Impacto:** Use cases não são testáveis sem mock completo do Prisma. Violação arquitetural documentada como padrão proibido em AGENTS.md.
**Correção recomendada:** Criar um `IEventRepository` port com método `findByIdAndOrganization(eventId, orgId)` e mover a query Prisma para o repositório de infraestrutura. O use case injeta o port, não o Prisma.

---

### ALTO

#### A1 — `minio-object-storage.adapter.ts:60-64`: `metaData['content-type']` com casing variável — validação falha silenciosamente

**Classificação:** ALTO
**Arquivo:** `apps/api/src/modules/media/infrastructure/adapters/minio-object-storage.adapter.ts`
**Trecho:** linhas 60–64
```ts
contentType: stat.metaData?.['content-type'] as string ?? 'application/octet-stream',
```
**Problema:** O MinIO pode retornar headers em casing variável (`Content-Type`, `content-type`). O cast `as string` sem verificação pode resultar em `undefined` sendo retornado como se fosse uma string válida, fazendo a validação de content-type no `ConfirmEventCoverUploadUseCase` falhar silenciosamente.
**Impacto:** Uploads legítimos rejeitados por content-type não verificável; ou arquivos inválidos aceitos com valor fallback `application/octet-stream`.
**Correção recomendada:**
```ts
const ct = stat.metaData?.['content-type'] ?? stat.metaData?.['Content-Type'];
contentType: typeof ct === 'string' ? ct : 'application/octet-stream',
```

---

#### A2 — `s3-object-storage.adapter.ts:19`: `AWS_S3_BUCKET!` sem validação no construtor

**Classificação:** ALTO
**Arquivo:** `apps/api/src/modules/media/infrastructure/adapters/s3-object-storage.adapter.ts`
**Trecho:** linha 19
```ts
this.bucket = env.AWS_S3_BUCKET!;
```
**Problema:** O operador `!` é usado com comentário `// validated at startup` mas sem verificação real no construtor. Se `env.AWS_S3_BUCKET` for `undefined` em runtime, o erro ocorrerá na primeira chamada de método, não no boot.
**Impacto:** Falha silenciosa no startup; o erro só aparece na primeira requisição de upload/download, possivelmente em produção.
**Correção recomendada:**
```ts
if (!env.AWS_S3_BUCKET) throw new Error('AWS_S3_BUCKET is required when OBJECT_STORAGE_PROVIDER=s3');
this.bucket = env.AWS_S3_BUCKET;
```

---

#### A3 — `confirm-event-cover-upload.use-case.ts:68-72`: `deleteObject` pode mascarar `BadRequestException` original

**Classificação:** ALTO
**Arquivo:** `apps/api/src/modules/media/application/use-cases/confirm-event-cover-upload.use-case.ts`
**Trecho:** linhas 68–72
```ts
if (metadata.sizeBytes > MAX_UPLOAD_SIZE_BYTES) {
  await this.storage.deleteObject(key);
  throw new BadRequestException(...);
}
```
**Problema:** Se `deleteObject(key)` lançar uma exceção (permissão negada no bucket, rede), a exceção de `deleteObject` sobrescreve o `BadRequestException` original. O objeto inválido permanece no storage e o caller recebe erro 500 em vez de mensagem clara.
**Impacto:** Objetos oversized podem permanecer no bucket indefinidamente após falha de delete. UX degradada com erro genérico.
**Correção recomendada:** Envolver `deleteObject` em `try/catch` separado com log de warning, e relançar sempre o `BadRequestException` original.

---

#### A4 — `generate-upload-url.dto.ts`: `contentType` aceita qualquer string — validação tardia

**Classificação:** ALTO
**Arquivo:** `apps/api/src/modules/media/presentation/dtos/generate-upload-url.dto.ts`
**Trecho:** campo `contentType`
**Problema:** A validação do DTO aceita qualquer string não vazia. A validação do valor permitido (`ALLOWED_CONTENT_TYPES`) é feita apenas no use case. Requisições com content-types inválidos chegam ao use case antes de serem rejeitadas.
**Impacto:** Feedback ao cliente é um 400 genérico do use case em vez do erro padronizado do pipe de validação NestJS.
**Correção recomendada:** Adicionar `@IsIn(ALLOWED_CONTENT_TYPES)` ao DTO, mantendo a validação no use case como defense-in-depth.

---

### MÉDIO

#### M1 — `minio-object-storage.adapter.ts:25-36`: Falha de inicialização do bucket silenciada

**Classificação:** MÉDIO
**Arquivo:** `apps/api/src/modules/media/infrastructure/adapters/minio-object-storage.adapter.ts`
**Trecho:** `onModuleInit`
**Problema:** A falha de inicialização do bucket é logada mas silenciada com `catch` — a aplicação continua subindo mesmo se o MinIO estiver inacessível.
**Impacto:** Em produção, a aplicação pode iniciar "com sucesso" e falhar em runtime ao tentar fazer upload, sem correlação óbvia com o problema de inicialização.
**Correção recomendada:** Relançar o erro após logging, ou registrar um health check que impeça a aplicação de aceitar tráfego enquanto o storage estiver indisponível.

---

#### M2 — `minio-object-storage.adapter.ts` e `s3-object-storage.adapter.ts`: `maxBytes` ignorado na geração da URL pré-assinada

**Classificação:** MÉDIO
**Arquivo:** ambos os adapters de object storage
**Trecho:** método `generateUploadUrl`
**Problema:** O parâmetro `maxBytes` é ignorado. Um cliente pode fazer upload de arquivo maior que o limite sem ser bloqueado pelo storage — a validação de tamanho ocorre apenas no `confirm`, após o upload já ter sido feito.
**Impacto:** O bucket pode receber arquivos grandes que o sistema depois rejeita e deleta. Storage desperdiçado e potencial vetor de DoS por preenchimento de bucket.
**Correção recomendada:** Documentar explicitamente que a validação de tamanho é post-upload-only, ou usar POST presigned URL com condições de policy para enforcement via storage.

---

#### M3 — `prisma-media-upload.repository.ts:30-31`: Casts `as` sem validação em runtime

**Classificação:** MÉDIO
**Arquivo:** `apps/api/src/modules/media/infrastructure/repositories/prisma-media-upload.repository.ts`
**Trecho:** linhas 30–31
```ts
purpose: record.purpose as 'EVENT_COVER' | 'ORG_LOGO',
status: record.status as 'PENDING' | 'CONFIRMED' | 'ORPHANED',
```
**Problema:** Casts `as` sem validação em runtime. Se o banco retornar um valor inesperado (nova enum adicionada ao schema Prisma sem atualizar o domínio), o cast silencioso corrompe o objeto de domínio sem nenhum erro.
**Impacto:** Bugs silenciosos difíceis de rastrear após migrações de schema.
**Correção recomendada:** Adicionar validação explícita antes do cast, ou usar um guard de tipo com `includes()`.

---

#### M4 — `media-upload.entity.ts`: Entidade anêmica — sem comportamentos de domínio

**Classificação:** MÉDIO
**Arquivo:** `apps/api/src/modules/media/domain/entities/media-upload.entity.ts`
**Trecho:** classe `MediaUpload` inteira
**Problema:** A entidade de domínio é um simples DTO com construtor — não tem nenhum comportamento ou invariante de domínio. Métodos como `confirm()`, `markOrphaned()`, `isExpired()` estão espalhados em use cases externos.
**Impacto:** Violação do padrão Rich Domain Model que o restante do projeto usa. Lógica de negócio não encapsulada.
**Correção recomendada:** Adicionar métodos de domínio como `confirm(sizeBytes: bigint): MediaUpload` e `markOrphaned(): MediaUpload`.

---

### BAIXO

#### B1 — `media.constants.ts`: `MAX_UPLOAD_SIZE_BYTES` não configurável via env

**Classificação:** BAIXO
**Arquivo:** `apps/api/src/modules/media/domain/media.constants.ts`
**Trecho:** `export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;`
**Problema:** O tamanho máximo não é configurável via variável de ambiente. Ajuste requer deploy.
**Correção recomendada:** Expor como `env.MAX_UPLOAD_SIZE_MB ?? 10` e derivar os bytes a partir daí.

---

#### B2 — `event-cover.controller.ts`: `uuidPipe` instanciado fora da classe

**Classificação:** BAIXO
**Arquivo:** `apps/api/src/modules/media/presentation/controllers/event-cover.controller.ts`
**Trecho:** linha 24
```ts
const uuidPipe = new ParseUUIDPipe({ version: '4' });
```
**Problema:** `uuidPipe` é instanciado como constante no escopo do módulo fora da classe, não como singleton gerenciado pelo NestJS. Não segue o padrão do framework e pode causar surpresas em cenários de override em testes.
**Correção recomendada:** Usar `new ParseUUIDPipe({ version: '4' })` inline nos decoradores `@Param`.

---

#### B3 — `get-event-cover-url.use-case.ts` e `confirm-event-cover-upload.use-case.ts`: Constante `DOWNLOAD_URL_EXPIRES_IN` duplicada

**Classificação:** BAIXO
**Arquivo:** ambos os use cases
**Trecho:** `const DOWNLOAD_URL_EXPIRES_IN = 3600;`
**Problema:** A mesma constante está duplicada em dois arquivos. Se o valor mudar, precisa ser alterado em dois lugares — risco de inconsistência de TTL.
**Correção recomendada:** Centralizar em `media.constants.ts` como `export const DOWNLOAD_URL_EXPIRES_IN_SECONDS = 3600`.

---

## Resumo

| Classificação | Quantidade |
|---|---|
| BLOQUEANTE | 2 |
| ALTO | 4 |
| MÉDIO | 4 |
| BAIXO | 3 |
| **Total** | **13** |

**Prioridade de correção:** BL1 (endpoint GET sem autenticação) → BL2 (violação hexagonal) → A1 (content-type casing) → A2 (bucket sem validação) → A3 (deleteObject mascara erro) → A4 (validação de contentType tardia) → M1 (falha silenciosa de bucket)

---

## Correções Implementadas

**2026-08-25 — Sessão de correção pós-revisão**

| ID | Correção | Arquivo |
|---|---|---|
| BL1 | Endpoint GET `/organizations/:orgId/events/:eventId/cover` agora tem `@UseGuards(ActorGuard, OrganizationRoleGuard)` e `@RequireCapability(OrganizationCapability.EVENTS_MANAGE)`. | `event-cover.controller.ts` |
| BL2 | Criado `IEventCoverRepository` port com métodos `existsInOrganization`, `findByOrganization`, `updateCoverKey`. Implementação `PrismaEventCoverRepository` em infrastructure. Todos os use cases agora injetam o port — `PrismaService` removido da camada de aplicação. Specs atualizadas para mockar `EVENT_COVER_REPOSITORY`. | `event-cover-repository.port.ts`, `prisma-event-cover.repository.ts`, 3 use cases, 3 specs |
| A1 | `minio-object-storage.adapter.ts`: content-type lido com fallback `Content-Type` / `content-type` para normalizar casing variável do MinIO. | `minio-object-storage.adapter.ts` |
| A2 | `s3-object-storage.adapter.ts`: `AWS_S3_BUCKET` validado no construtor (throw se ausente em vez de operador `!`). | `s3-object-storage.adapter.ts` |
| A3 | `confirm-event-cover-upload.use-case.ts`: `deleteObject` envolto em `try/catch` separado — erro de delete é logado como warning e `BadRequestException` original sempre relançado. | `confirm-event-cover-upload.use-case.ts` |
| A4 | `generate-upload-url.dto.ts`: `contentType` agora valida com `@IsIn(ALLOWED_CONTENT_TYPES)` no DTO. | `generate-upload-url.dto.ts` |
| B2 | `uuidPipe` instanciado inline em `@Param` em vez de escopo de módulo. | `event-cover.controller.ts` |
| B3 | `DOWNLOAD_URL_EXPIRES_IN_SECONDS` centralizado em `media.constants.ts`. | `media.constants.ts` |

**Pendente:**
- M1: Falha de inicialização de bucket silenciada — relançar erro ou health check
- M2: `maxBytes` ignorado na URL pré-assinada — documentar limitação
- M3: Casts `as` sem validação em runtime no repositório
- M4: Entidade `MediaUpload` anêmica — adicionar métodos de domínio
- B1: `MAX_UPLOAD_SIZE_BYTES` configurável via env
