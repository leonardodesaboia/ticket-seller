import { renderHook, act } from '@testing-library/react';
import { useAttendancePolling } from './useAttendancePolling';
import type { AttendanceResponse } from '../../../shared/api/attendance.api';

// Mock auth so the hook works outside AuthProvider
jest.mock('@/features/auth', () => ({
  useAuth: () => ({ token: 'test-token', userId: 'user-1' }),
}));

// Mock the attendance API — use relative path to bypass moduleNameMapper hoisting
jest.mock('../../../shared/api/attendance.api', () => ({
  getEventAttendance: jest.fn(),
  API_BASE_URL: 'http://localhost:3000',
}));

import { getEventAttendance } from '../../../shared/api/attendance.api';
const mockGetEventAttendance = getEventAttendance as jest.MockedFunction<typeof getEventAttendance>;

const mockData: AttendanceResponse = {
  totalIssued: 100,
  totalAdmitted: 60,
  totalRemaining: 40,
  attendanceRate: 60.0,
  byTicketType: [],
  recentCheckIns: [],
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  // Ensure document is visible by default
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => 'visible',
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useAttendancePolling', () => {
  it('1. fetches data on mount', async () => {
    mockGetEventAttendance.mockResolvedValue(mockData);

    const { result } = renderHook(() => useAttendancePolling('org-1', 'event-1'));

    // Initially null before fetch completes
    expect(result.current.data).toBeNull();

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockGetEventAttendance).toHaveBeenCalledTimes(1);
    expect(mockGetEventAttendance).toHaveBeenCalledWith('org-1', 'event-1', expect.any(String));
    expect(result.current.data).toEqual(mockData);
    expect(result.current.error).toBeNull();
  });

  it('2. polls every 15 seconds', async () => {
    mockGetEventAttendance.mockResolvedValue(mockData);

    renderHook(() => useAttendancePolling('org-1', 'event-1'));

    // Initial load
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockGetEventAttendance).toHaveBeenCalledTimes(1);

    // Advance 15 seconds → second call
    await act(async () => {
      jest.advanceTimersByTime(15_000);
      await Promise.resolve();
    });

    expect(mockGetEventAttendance).toHaveBeenCalledTimes(2);

    // Advance another 15 seconds → third call
    await act(async () => {
      jest.advanceTimersByTime(15_000);
      await Promise.resolve();
    });

    expect(mockGetEventAttendance).toHaveBeenCalledTimes(3);
  });

  it('3. pauses polling when document is hidden', async () => {
    mockGetEventAttendance.mockResolvedValue(mockData);

    renderHook(() => useAttendancePolling('org-1', 'event-1'));

    // Initial load
    await act(async () => {
      await Promise.resolve();
    });

    // Simulate page becoming hidden
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });

    // Advance 15 seconds — the interval fires but skips because hidden
    await act(async () => {
      jest.advanceTimersByTime(15_000);
      await Promise.resolve();
    });

    // Still only 1 call from mount
    expect(mockGetEventAttendance).toHaveBeenCalledTimes(1);
  });

  it('4. resumes fetch when document becomes visible again', async () => {
    mockGetEventAttendance.mockResolvedValue(mockData);

    renderHook(() => useAttendancePolling('org-1', 'event-1'));

    await act(async () => {
      await Promise.resolve();
    });

    // Page hides
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });

    // Page becomes visible again → fires visibilitychange event
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });

    expect(mockGetEventAttendance).toHaveBeenCalledTimes(2);
  });

  it('5. sets error state on fetch failure', async () => {
    mockGetEventAttendance.mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => useAttendancePolling('org-1', 'event-1'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('network error');
  });

  it('6. cleans up interval and event listener on unmount', async () => {
    mockGetEventAttendance.mockResolvedValue(mockData);
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener');

    const { unmount } = renderHook(() => useAttendancePolling('org-1', 'event-1'));

    await act(async () => {
      await Promise.resolve();
    });

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
    expect(removeEventListenerSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));

    clearIntervalSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });
});
