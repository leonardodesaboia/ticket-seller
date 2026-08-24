Relatório da TASK-056 — Media & Uploads Foundation

Status

COMPLETED

Commit

7ba368f — feat(media): implement TASK-056 — media uploads foundation

Arquivos alterados

apps/api/prisma/migrations/20260818000037_media_uploads/migration.sql: criado — tabela media_uploads com enum de purpose e status; coluna cover_image_key em events
apps/api/prisma/schema.prisma: expandido — modelo MediaUpload, campo coverImageKey em Event
apps/api/src/shared/ports/object-storage.port.ts: criado — IObjectStoragePort com generateUploadUrl, generateDownloadUrl, headObject, deleteObject; símbolo OBJECT_STORAGE_PORT
apps/api/src/modules/media/domain/media.constants.ts: criado — ALLOWED_CONTENT_TYPES ('image/jpeg', 'image/png', 'image/webp'); tipo AllowedContentType
apps/api/src/modules/media/domain/entities/media-upload.entity.ts: criado — entidade MediaUpload com estados PENDING, CONFIRMED, ORPHANED
apps/api/src/modules/media/domain/ports/media-upload-repository.port.ts: criado — IMediaUploadRepository
apps/api/src/modules/media/infrastructure/adapters/minio-object-storage.adapter.ts: criado — MinioObjectStorageAdapter usando pacote minio; cria bucket via onModuleInit se não existir; presignedPutObject para upload, presignedGetObject para download
apps/api/src/modules/media/infrastructure/adapters/s3-object-storage.adapter.ts: criado — S3ObjectStorageAdapter usando @aws-sdk/client-s3 + @aws-sdk/s3-request-presigner; PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand
apps/api/src/modules/media/infrastructure/repositories/prisma-media-upload.repository.ts: criado — PrismaMediaUploadRepository
apps/api/src/modules/media/application/use-cases/generate-event-cover-upload-url.use-case.ts + .spec.ts: criado
apps/api/src/modules/media/application/use-cases/confirm-event-cover-upload.use-case.ts + .spec.ts: criado
apps/api/src/modules/media/application/use-cases/get-event-cover-url.use-case.ts + .spec.ts: criado
apps/api/src/modules/media/presentation/controllers/event-cover.controller.ts: criado — POST /organizations/:orgId/events/:eventId/cover/upload-url, POST /confirm, GET /
apps/api/src/modules/media/presentation/dtos/generate-upload-url.dto.ts: criado — GenerateUploadUrlDto com contentType e sizeBytes
apps/api/src/modules/media/presentation/dtos/confirm-upload.dto.ts: criado — ConfirmUploadDto com uploadId
apps/api/src/modules/media/media.module.ts: criado — factory que seleciona MinioObjectStorageAdapter ou S3ObjectStorageAdapter conforme OBJECT_STORAGE_PROVIDER; apenas um adapter é instanciado por vez
apps/api/src/modules/notifications/infrastructure/adapters/resend-email.adapter.ts: criado — ResendEmailAdapter implementando IEmailProvider usando SDK resend
apps/api/src/modules/notifications/infrastructure/notifications.infrastructure.module.ts: modificado — factory: se RESEND_API_KEY presente → ResendEmailAdapter; caso contrário → SmtpEmailAdapter (MailHog/Mailpit dev)
apps/api/src/platform/config/env.ts: modificado — OBJECT_STORAGE_PROVIDER, MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET, AWS_S3_BUCKET, AWS_S3_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, RESEND_API_KEY
apps/api/src/app.module.ts: modificado — MediaModule registrado
apps/api/package.json: modificado — minio, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, resend adicionados
pnpm-lock.yaml: atualizado

Implementado

IObjectStoragePort: port hexagonal para storage, independente de provider; dois adapters implementados (MinIO para dev, S3 para prod)
Fluxo de upload em dois passos: (1) POST /cover/upload-url → servidor gera presigned PUT URL (válida 5 min); (2) cliente faz PUT direto para o storage; (3) POST /confirm → servidor chama headObject para verificar existência e confirma MediaUpload
Nomeação de keys pelo servidor: uploads/{organizationId}/{purpose}/{entityId}/{uuid}.{ext} — cliente não controla o path; previne path traversal
Content-type restrito a allowlist: ALLOWED_CONTENT_TYPES.includes(dto.contentType) — rejeita qualquer tipo que não seja jpeg, png ou webp; a presigned URL também é gerada com esse content-type, de modo que o storage rejeita PUT com type diferente
MediaUpload entity com ciclo de vida PENDING → CONFIRMED (ou ORPHANED em limpeza futura)
MinioObjectStorageAdapter cria bucket via onModuleInit se não existir; falha de conexão é logada mas não trava o startup (comportamento esperado em testes sem MinIO rodando)
ResendEmailAdapter: implementa IEmailProvider existente; nenhuma alteração necessária em use cases de notificação; selecionado automaticamente quando RESEND_API_KEY está presente no ambiente
SmtpEmailAdapter mantido como fallback para development com MailHog/Mailpit

Decisões tomadas

Presigned URL (sem proxy): servidor não processa bytes de upload; elimina carga de upload no event loop do Node.js; sem limite de tamanho de request na API
Factory pattern em MediaModule: apenas o adapter selecionado é instanciado; sem dupla instância de MinIO e S3 simultaneamente
cover_image_key persistido via Prisma direto no use case (exceção documentada pela spec): TASK-056 determina explicitamente que a key é gravada em events.cover_image_key sem passar pelo EventsModule; evita acoplamento inter-módulo desnecessário para MVP
Multi-tenancy obrigatório nas queries de evento: GetEventCoverUrlUseCase e ConfirmEventCoverUploadUseCase incluem organizationId no WHERE — sem isso, qualquer organização poderia sobrescrever a imagem de outra
ResendEmailAdapter por env var: ausência de RESEND_API_KEY não causa falha de startup — SmtpEmailAdapter é usado automaticamente em development

Testes executados

Comando	Resultado
npx tsc --noEmit	aprovado (0 erros)
npx jest	426/426 aprovados (antes: 413/413 — +13 testes)

Bugs corrigidos durante revisão

GetEventCoverUrlUseCase ausência de organizationId no WHERE: corrigido para where: { id: eventId, organizationId } — sem isso, qualquer org poderia ler URL de outra
ConfirmEventCoverUploadUseCase ausência de organizationId no WHERE para update: corrigido — prevenção de sobrescrita cross-tenant
Content-type validation usava startsWith('image/'): substituído por ALLOWED_CONTENT_TYPES.includes() — evita tipos indesejados como image/svg+xml
MinioObjectStorageAdapter e S3ObjectStorageAdapter instanciados simultaneamente: corrigido via factory — apenas um é instanciado conforme OBJECT_STORAGE_PROVIDER

Pacotes instalados

minio — SDK oficial MinIO para Node.js
@aws-sdk/client-s3 — AWS SDK v3 para S3
@aws-sdk/s3-request-presigner — presigned URLs para AWS SDK v3
resend — SDK oficial Resend para email transacional

Riscos identificados

Arquivos PENDING sem confirmação (uploads iniciados mas não confirmados via /confirm): ficam como MediaUpload PENDING indefinidamente; nenhum job de cleanup implementado para MVP (consequência negativa documentada no ADR-008)
Sem validação de tamanho via headObject no /confirm: o campo sizeBytes é gravado na presigned URL como header, mas não há verificação adicional no confirm step além de verificar que o objeto existe

Pendências

Cleanup de MediaUpload PENDING e objetos órfãos no storage: fora do escopo do MVP, documentado como consequência negativa no ADR-008
Logo de organização (purpose=ORG_LOGO): entidade e constants preparados, endpoints não implementados na TASK-056 (somente EVENT_COVER foi implementado)

Documentação atualizada

ADR-008 — Object storage port-based com MinIO/S3 e ResendEmailAdapter — registrado em docs/decisions/
docs/CURRENT_STATE.md atualizado para refletir conclusão da TASK-056
