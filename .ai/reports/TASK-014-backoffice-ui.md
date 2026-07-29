# TASK-014 — Backoffice UI: Completion Report

**Status:** COMPLETED  
**Branch:** `main`  
**Date:** 2026-07-29

---

## Scope

First functional UI slice in the backoffice: organization and event creation/display features.

---

## What Was Implemented

### Infrastructure
- `apps/backoffice-web/src/app/providers.tsx`: TanStack Query `QueryClientProvider` (`'use client'`)

### Feature: organizations
- `src/features/organizations/types.ts`: `Organization` type
- `src/features/organizations/schemas.ts`: Zod schema (name 1–200 chars, slug regex `^[a-z0-9]+(?:-[a-z0-9]+)*$`)
- `src/features/organizations/api.ts`: `createOrganization(dto, devUserId)` — POST with `X-Dev-User-Id`
- `src/features/organizations/hooks.ts`: `useCreateOrganization()` → `useMutation`
- `src/features/organizations/components/CreateOrganizationForm.tsx`: react-hook-form + zodResolver

### Feature: events
- `src/features/events/types.ts`: `Event` type
- `src/features/events/schemas.ts`: Zod schema (title required)
- `src/features/events/api.ts`: `createEvent`, `getEvent` with `X-Dev-User-Id`
- `src/features/events/hooks.ts`: `useCreateEvent()`, `useGetEvent()` → useMutation/useQuery
- `src/features/events/components/CreateEventForm.tsx`: react-hook-form + zodResolver
- `src/features/events/components/EventDetail.tsx`: status badges using semantic design tokens

### Pages
- `src/app/organizations/new/page.tsx`
- `src/app/organizations/[organizationId]/events/new/page.tsx`
- `src/app/organizations/[organizationId]/events/[eventId]/page.tsx`

All pages read `process.env['NEXT_PUBLIC_DEV_USER_ID']` as dev actor.

---

## Invariants Enforced

- `X-Dev-User-Id` is read from `NEXT_PUBLIC_DEV_USER_ID` env var — never hardcoded.
- All API functions pass the dev user ID explicitly to match the `DevelopmentActorAdapter` contract.
