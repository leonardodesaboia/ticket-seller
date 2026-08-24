TASK-056 — Media & Uploads Foundation

Status: PLANNED

Objetivo

Criar a infraestrutura de upload de arquivos via presigned URL: porta `IObjectStoragePort`, adapter MinIO (development) e S3 (production), adapter Resend (email transacional em production) substituindo o provider SMTP para envio real. Implementar o fluxo de upload de imagem de capa de evento.

Resultado observável

- `POST /organizations/:orgId/events/:eventId/cover/upload-url` retorna URL assinada de PUT + key interna.
- `POST /organizations/:orgId/events/:eventId/cover/confirm` confirma upload, persiste `coverImageKey` no evento.
- `GET /organizations/:orgId/events/:eventId/cover` retorna URL temporária de download.
- Frontend faz PUT direto para storage — servidor não faz proxy de bytes.
- Em development: MinIO servindo via Docker Compose.
- Em production: S3 via `OBJECT_STORAGE_PROVIDER=s3`.
- Email transacional em production: ResendEmailAdapter (substitui SmtpEmailAdapter quando `RESEND_API_KEY` presente).
- `pnpm typecheck`, `pnpm lint`, `pnpm test` aprovados.

Contexto obrigatório

O agente deve ler somente:
- AGENTS.md
- .ai/tasks/TASK-056-media-uploads.md
- docs/decisions/ADR-008-object-storage-port-minio-s3-resend.md
- apps/api/prisma/schema.prisma (estado após TASK-055)
- apps/api/src/modules/notifications/ (referência de IEmailPort existente)
- apps/api/src/platform/config/env.ts
- docker-compose.yaml (configuração atual)

Migration (base: após TASK-055)

```
20260818000037_media_uploads
  CREATE TABLE media_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    uploader_id UUID NOT NULL REFERENCES users(id),
    object_key TEXT NOT NULL UNIQUE,
    content_type VARCHAR(128) NOT NULL,
    size_bytes BIGINT,
    purpose VARCHAR(64) NOT NULL
      CHECK (purpose IN ('EVENT_COVER','ORG_LOGO')),
    entity_id UUID NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING'
      CHECK (status IN ('PENDING','CONFIRMED','ORPHANED')),
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX media_uploads_org_entity ON media_uploads(organization_id, entity_id);
  CREATE INDEX media_uploads_status_created ON media_uploads(status, created_at)
    WHERE status = 'PENDING';

  ALTER TABLE events ADD COLUMN cover_image_key TEXT;
```

Arquivos permitidos

Backend:
- apps/api/src/shared/ports/object-storage.port.ts (NOVO)
- apps/api/src/modules/media/ (NOVO módulo)
  - domain/entities/media-upload.entity.ts
  - domain/ports/media-upload.repository.port.ts
  - application/use-cases/generate-event-cover-upload-url.use-case.ts + .spec.ts
  - application/use-cases/confirm-event-cover-upload.use-case.ts + .spec.ts
  - application/use-cases/get-event-cover-url.use-case.ts
  - infrastructure/adapters/minio-object-storage.adapter.ts
  - infrastructure/adapters/s3-object-storage.adapter.ts
  - infrastructure/adapters/resend-email.adapter.ts
  - infrastructure/repositories/prisma-media-upload.repository.ts
  - presentation/controllers/event-cover.controller.ts
  - presentation/dtos/
  - media.module.ts
- apps/api/src/modules/notifications/infrastructure/adapters/ (EXPANDIR — ResendEmailAdapter)
- apps/api/src/platform/config/env.ts (EXPANDIR — variáveis de storage e email)
- apps/api/src/app.module.ts (EXPANDIR — importar MediaModule)
- apps/api/prisma/schema.prisma (EXPANDIR — MediaUpload model + Event.coverImageKey)
- apps/api/prisma/migrations/ (1 nova migration)
- docker-compose.yaml (EXPANDIR — serviço minio se não existir)

Arquivos proibidos

- apps/api/src/modules/events/ (cover_image_key é persistido via SQL direto no use case, sem tocar no EventsModule)
- apps/api/src/modules/identity/ (sem alterações)
- pnpm-lock.yaml

Packages novos

```
minio (SDK MinIO — compatível com S3)
@aws-sdk/client-s3 (S3 adapter)
@aws-sdk/s3-request-presigner (presigned URLs S3)
resend (Resend email SDK)
```

Variáveis de ambiente novas

```
OBJECT_STORAGE_PROVIDER   'minio' | 's3', default 'minio'
MINIO_ENDPOINT            string, default 'http://localhost:9000'
MINIO_ACCESS_KEY          string, default 'minioadmin'
MINIO_SECRET_KEY          string, default 'minioadmin'
MINIO_BUCKET              string, default 'ticket-seller'
AWS_S3_BUCKET             string, obrigatório se OBJECT_STORAGE_PROVIDER=s3
AWS_S3_REGION             string, default 'us-east-1'
AWS_ACCESS_KEY_ID         string, obrigatório se OBJECT_STORAGE_PROVIDER=s3
AWS_SECRET_ACCESS_KEY     string, obrigatório se OBJECT_STORAGE_PROVIDER=s3
RESEND_API_KEY            string, opcional (sem envio real se ausente)
FRONTEND_URL              string, default 'http://localhost:3001' (para links de email)
```

IObjectStoragePort

```typescript
interface ObjectMetadata {
  key: string;
  contentType: string;
  sizeBytes: number;
}

interface IObjectStoragePort {
  generateUploadUrl(params: {
    key: string;
    contentType: string;
    maxBytes: number;
    expiresInSeconds?: number;
  }): Promise<string>;

  generateDownloadUrl(params: {
    key: string;
    expiresInSeconds?: number;
  }): Promise<string>;

  headObject(key: string): Promise<ObjectMetadata | null>;
  deleteObject(key: string): Promise<void>;
}
```

Requisitos funcionais

1. `POST /organizations/:orgId/events/:eventId/cover/upload-url` (requer events.manage):
   - Valida content-type do request: deve ser image/jpeg, image/png ou image/webp.
   - Gera key interna: `uploads/{orgId}/event-cover/{eventId}/{uuid}.{ext}`.
   - Cria MediaUpload com status PENDING.
   - Retorna: `{ uploadUrl: string, key: string, expiresIn: 300 }`.
   - uploadUrl é um presigned PUT válido por 5min.

2. `POST /organizations/:orgId/events/:eventId/cover/confirm` (requer events.manage):
   - Recebe: `{ key: string }`.
   - Verifica: MediaUpload.status = PENDING, MediaUpload.organizationId = orgId, MediaUpload.entityId = eventId.
   - Chama headObject(key) para verificar que arquivo existe no storage.
   - Valida content-type retornado (apenas image/*).
   - Atualiza MediaUpload.status = CONFIRMED, .sizeBytes = headObject.sizeBytes.
   - Atualiza Event.coverImageKey = key (UPDATE direto na tabela events).
   - 200 com `{ key, url: generateDownloadUrl(key, 3600) }`.

3. `GET /organizations/:orgId/events/:eventId/cover` (público ou com auth):
   - Se Event.coverImageKey IS NULL → 404.
   - Retorna `{ url: generateDownloadUrl(key, 3600) }`.

4. ResendEmailAdapter:
   - Implementa IEmailProvider (porta existente em notifications).
   - Usa `RESEND_API_KEY` para envio real.
   - Se ausente, `LogOnlyEmailAdapter` loga o email (sem envio) — útil em development sem configurar SMTP.
   - Factory no NotificationsModule: se RESEND_API_KEY → ResendEmailAdapter, senão SmtpEmailAdapter.

5. MinIO no Docker Compose:
   - Serviço `minio` com imagem `minio/minio`.
   - Porta 9000 (API) + 9001 (console).
   - Volume para persistência.
   - Bucket criado via initContainer ou mc command em entrypoint.

Invariantes

- Key gerada internamente — nunca usar filename enviado pelo usuário.
- Content-type validado no backend (headObject) após upload, não confiado do frontend.
- MediaUpload com status PENDING há mais de 1h → marcados ORPHANED por cleanup worker (fora do escopo desta task — documentar como pendência).
- Apenas images confirmadas são persistidas em events.cover_image_key.

Segurança

- presigned PUT URL gerada com content-type restrito (só o tipo informado no request de upload-url).
- Sem proxy de bytes pelo servidor — upload vai direto do browser para storage.
- Key não contém informações do usuário além do orgId (já filtrado por autenticação).
- Download URLs expiram em 1h.

Fora do escopo

- Upload de logo de organização (mesmo padrão — pode ser adicionado com nova purpose sem nova task).
- Resize/thumbnail automático.
- CDN na frente do storage.
- Cleanup worker de MediaUpload ORPHANED.
- Galeria de imagens.

Critérios de aceite

- Fluxo completo: upload-url → PUT direto → confirm → GET cover URL funciona end-to-end.
- Content-type inválido (ex: application/pdf) → 422 na geração do upload-url.
- Key de outra org → 403 no confirm.
- MinIO funciona em development sem configuração adicional.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` aprovados.

Comandos

```bash
pnpm --filter @ticket-seller/api add minio @aws-sdk/client-s3 @aws-sdk/s3-request-presigner resend
pnpm --filter @ticket-seller/api prisma migrate dev --name media_uploads
pnpm --filter @ticket-seller/api lint
pnpm --filter @ticket-seller/api typecheck
pnpm --filter @ticket-seller/api test
```

Conclusão esperada

Arquivos alterados: [listar]
Implementado: [comportamento]
Testes: [comando]: aprovado/reprovado
Decisões: [decisão]
Pendências: [pendência ou "Nenhuma"]
Próxima tarefa: TASK-057 — Rate Limiting & API Hardening.
