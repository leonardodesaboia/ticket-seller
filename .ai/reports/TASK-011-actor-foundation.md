# TASK-011 — Actor Foundation: Completion Report

**Status:** COMPLETED  
**Branch:** `main`  
**Date:** 2026-07-29

---

## Scope

Establish actor identification infrastructure: `IActorAdapter` port, `DevelopmentActorAdapter`, `ActorGuard`, and `CurrentActor` decorator.

---

## What Was Implemented

### `apps/api/src/platform/http/actor-adapter.port.ts`
- `IActorAdapter` interface with `resolve(request)` returning `ICurrentActor | null`
- `ACTOR_ADAPTER` Symbol for NestJS DI

### `apps/api/src/platform/http/adapters/development-actor.adapter.ts`
- Reads `X-Dev-User-Id` header
- Returns `null` immediately when `NODE_ENV === 'production'`
- Trims and validates the header value

### `apps/api/src/platform/http/guards/actor.guard.ts`
- `ActorGuard implements CanActivate`
- Calls `IActorAdapter.resolve(request)` — throws `UnauthorizedException` on null
- Attaches actor to `request['actor']`

### `apps/api/src/shared/kernel/actor.types.ts`
- `ICurrentActor { userId: string }`

### `apps/api/src/shared/kernel/current-actor.decorator.ts`
- `@CurrentActor()` param decorator — reads `request['actor']`

### `apps/api/src/platform/http/http.module.ts`
- Provides `DevelopmentActorAdapter` bound to `ACTOR_ADAPTER`
- Exports `ActorGuard` and `ACTOR_ADAPTER`

---

## Invariants Enforced

- `DevelopmentActorAdapter` is disabled in production (`NODE_ENV` check).
- Guard throws 401 when no actor resolved — endpoints never receive a null actor.
