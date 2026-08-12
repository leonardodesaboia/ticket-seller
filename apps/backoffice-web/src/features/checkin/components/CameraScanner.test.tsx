import { render, act, waitFor } from '@testing-library/react';
import { CameraScanner } from './CameraScanner';

const FAKE_TOKEN = 'a'.repeat(64);

// Mock jsqr module
jest.mock('jsqr', () => ({
  __esModule: true,
  default: jest.fn(),
}));

import jsQR from 'jsqr';
const mockJsQR = jsQR as jest.MockedFunction<typeof jsQR>;

// Helpers to build a fake stream
function makeFakeTrack() {
  return { stop: jest.fn() };
}

function makeFakeStream(tracks = [makeFakeTrack()]) {
  return {
    getTracks: jest.fn(() => tracks),
  } as unknown as MediaStream;
}

// Mock requestAnimationFrame / cancelAnimationFrame
let rafCallback: FrameRequestCallback | null = null;
const mockRaf = jest.fn((cb: FrameRequestCallback) => {
  rafCallback = cb;
  return 1;
});
const mockCaf = jest.fn();

beforeAll(() => {
  global.requestAnimationFrame = mockRaf as unknown as typeof requestAnimationFrame;
  global.cancelAnimationFrame = mockCaf;
});

beforeEach(() => {
  mockJsQR.mockReturnValue(null);
  rafCallback = null;
  mockRaf.mockClear();
  mockCaf.mockClear();
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('CameraScanner', () => {
  it('calls getUserMedia with environment facing mode on mount', async () => {
    const fakeStream = makeFakeStream();
    const getUserMedia = jest.fn().mockResolvedValue(fakeStream);
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia },
      writable: true,
      configurable: true,
    });

    await act(async () => {
      render(<CameraScanner onScan={jest.fn()} onCameraError={jest.fn()} />);
    });

    expect(getUserMedia).toHaveBeenCalledWith({ video: { facingMode: 'environment' } });
  });

  it('calls onCameraError when getUserMedia is rejected', async () => {
    const onCameraError = jest.fn();
    const getUserMedia = jest.fn().mockRejectedValue(new Error('Permission denied'));
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia },
      writable: true,
      configurable: true,
    });

    await act(async () => {
      render(<CameraScanner onScan={jest.fn()} onCameraError={onCameraError} />);
    });

    await waitFor(() => {
      expect(onCameraError).toHaveBeenCalledTimes(1);
    });
  });

  it('stops all tracks on unmount', async () => {
    const track = makeFakeTrack();
    const fakeStream = makeFakeStream([track]);
    const getUserMedia = jest.fn().mockResolvedValue(fakeStream);
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia },
      writable: true,
      configurable: true,
    });

    let unmount!: () => void;
    await act(async () => {
      const result = render(<CameraScanner onScan={jest.fn()} onCameraError={jest.fn()} />);
      unmount = result.unmount;
    });

    act(() => {
      unmount();
    });

    expect(track.stop).toHaveBeenCalled();
  });

  it('calls onScan when jsQR detects a QR code and not disabled', async () => {
    const onScan = jest.fn();
    mockJsQR.mockReturnValue({ data: FAKE_TOKEN } as ReturnType<typeof jsQR>);

    const fakeStream = makeFakeStream();
    const getUserMedia = jest.fn().mockResolvedValue(fakeStream);
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia },
      writable: true,
      configurable: true,
    });

    // Mock canvas context
    const mockGetImageData = jest.fn(() => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }));
    const mockDrawImage = jest.fn();
    const mockContext = { drawImage: mockDrawImage, getImageData: mockGetImageData };
    HTMLCanvasElement.prototype.getContext = jest.fn(() => mockContext) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    await act(async () => {
      render(<CameraScanner onScan={onScan} onCameraError={jest.fn()} disabled={false} />);
    });

    // Simulate video element ready state
    await act(async () => {
      if (rafCallback) {
        // Mock video having data
        Object.defineProperty(HTMLVideoElement.prototype, 'readyState', {
          get: () => 4, // HAVE_ENOUGH_DATA
          configurable: true,
        });
        Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', {
          get: () => 640,
          configurable: true,
        });
        Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', {
          get: () => 480,
          configurable: true,
        });
        rafCallback(0);
      }
    });

    await waitFor(() => {
      expect(onScan).toHaveBeenCalledWith(FAKE_TOKEN);
    });
  });

  it('does not call onScan when disabled is true', async () => {
    const onScan = jest.fn();
    mockJsQR.mockReturnValue({ data: FAKE_TOKEN } as ReturnType<typeof jsQR>);

    const fakeStream = makeFakeStream();
    const getUserMedia = jest.fn().mockResolvedValue(fakeStream);
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia },
      writable: true,
      configurable: true,
    });

    const mockGetImageData = jest.fn(() => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }));
    const mockContext = { drawImage: jest.fn(), getImageData: mockGetImageData };
    HTMLCanvasElement.prototype.getContext = jest.fn(() => mockContext) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    await act(async () => {
      render(<CameraScanner onScan={onScan} onCameraError={jest.fn()} disabled={true} />);
    });

    await act(async () => {
      if (rafCallback) {
        Object.defineProperty(HTMLVideoElement.prototype, 'readyState', {
          get: () => 4,
          configurable: true,
        });
        rafCallback(0);
      }
    });

    expect(onScan).not.toHaveBeenCalled();
  });
});
