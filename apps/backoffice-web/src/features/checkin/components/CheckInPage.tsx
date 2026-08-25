'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { performCheckIn, type AdmissionDecision } from '@/shared/api/check-in.api';
import { CameraScanner } from './CameraScanner';
import { ManualEntryForm } from './ManualEntryForm';
import { DecisionFeedback } from './DecisionFeedback';

const DEV_USER_ID = process.env['NEXT_PUBLIC_DEV_USER_ID'] ?? '';

type PageState = 'SCANNING' | 'VALIDATING' | 'FEEDBACK' | 'OFFLINE' | 'CAMERA_ERROR';

interface FeedbackResult {
  decision: AdmissionDecision;
  allowed: boolean;
}

interface CheckInPageProps {
  orgId: string;
  eventId: string;
}

export function CheckInPage({ orgId, eventId }: CheckInPageProps) {
  const [state, setState] = useState<PageState>('SCANNING');
  const [feedback, setFeedback] = useState<FeedbackResult | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current !== null) {
        clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  const handleToken = useCallback(
    async (token: string) => {
      if (state === 'VALIDATING') return;

      const idempotencyKey = globalThis.crypto?.randomUUID?.() ?? '<mock-uuid>';

      setState('VALIDATING');

      try {
        const result = await performCheckIn(
          orgId,
          eventId,
          { credential: token },
          DEV_USER_ID,
          idempotencyKey,
        );

        setFeedback({ decision: result.decision, allowed: result.allowed });
        setState('FEEDBACK');

        feedbackTimerRef.current = setTimeout(() => {
          setFeedback(null);
          setState('SCANNING');
        }, 2000);
      } catch (err) {
        const isNetworkError =
          err instanceof TypeError ||
          (err instanceof Error && err.name === 'TimeoutError') ||
          (err instanceof Error && err.name === 'AbortError');

        if (isNetworkError) {
          setState('OFFLINE');
        } else {
          // Non-network API errors (4xx/5xx) — go back to SCANNING so user can try again
          setState('SCANNING');
        }
      }
    },
    [state, orgId, eventId],
  );

  const handleCameraError = useCallback(() => {
    setState('CAMERA_ERROR');
  }, []);

  const handleRetry = useCallback(() => {
    setState('SCANNING');
  }, []);

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-6 p-4">
      <header>
        <h1 className="text-xl font-bold text-foreground">Check-in</h1>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {state === 'SCANNING' && 'Aponte a câmera para o QR code do ingresso'}
          {state === 'VALIDATING' && 'Validando ingresso...'}
          {state === 'FEEDBACK' && 'Resultado do check-in'}
          {state === 'OFFLINE' && 'Sem conexão'}
          {state === 'CAMERA_ERROR' && 'Câmera indisponível — use a entrada manual'}
        </p>
      </header>

      {(state === 'SCANNING' || state === 'VALIDATING' || state === 'FEEDBACK') && (
        <CameraScanner
          onScan={handleToken}
          onCameraError={handleCameraError}
          disabled={state !== 'SCANNING'}
        />
      )}

      {state === 'FEEDBACK' && feedback && (
        <DecisionFeedback decision={feedback.decision} allowed={feedback.allowed} />
      )}

      {state === 'OFFLINE' && (
        <div
          role="alert"
          className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive"
        >
          <p className="font-medium">Sem conexão — verifique a internet</p>
          <button
            onClick={handleRetry}
            className="mt-2 text-sm underline hover:no-underline"
            type="button"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {state === 'CAMERA_ERROR' && (
        <ManualEntryForm onSubmit={handleToken} isLoading={false} />
      )}
    </main>
  );
}
