'use client';

import { useEffect, useRef } from 'react';
import jsQR from 'jsqr';

interface CameraScannerProps {
  onScan: (token: string) => void;
  onCameraError: () => void;
  disabled?: boolean;
}

export function CameraScanner({ onScan, onCameraError, disabled = false }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  // Keep latest callbacks and disabled flag in refs so the scan loop
  // doesn't need to restart when they change.
  const disabledRef = useRef(disabled);
  const onScanRef = useRef(onScan);
  const onCameraErrorRef = useRef(onCameraError);

  disabledRef.current = disabled;
  onScanRef.current = onScan;
  onCameraErrorRef.current = onCameraError;

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        scanFrame();
      } catch {
        if (!cancelled) {
          onCameraErrorRef.current();
        }
      }
    }

    function scanFrame() {
      if (cancelled) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      const context = canvas.getContext('2d');
      if (!context) return;

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        if (!disabledRef.current) {
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);

          if (code && code.data) {
            onScanRef.current(code.data);
          }
        }
      }

      rafRef.current = requestAnimationFrame(scanFrame);
    }

    void startCamera();

    return () => {
      cancelled = true;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative w-full overflow-hidden rounded-lg bg-black" aria-label="Scanner de QR code">
      <video
        ref={videoRef}
        muted
        playsInline
        className="w-full"
        aria-hidden="true"
      />
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
      {disabled && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <p className="text-sm font-medium text-white" aria-live="polite">
            Validando...
          </p>
        </div>
      )}
    </div>
  );
}
