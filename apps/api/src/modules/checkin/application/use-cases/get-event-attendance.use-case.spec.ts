import { NotFoundException } from '@nestjs/common';
import { GetEventAttendanceUseCase } from './get-event-attendance.use-case';
import {
  EventAttendanceData,
  ICheckInRepository,
} from '../../domain/ports/check-in-repository.port';

function makeMockRepo(attendanceData: EventAttendanceData | null): ICheckInRepository {
  return {
    findByIdempotencyKey: jest.fn(),
    existsAdmittedForTicket: jest.fn(),
    createCheckIn: jest.fn(),
    getEventAttendance: jest.fn().mockResolvedValue(attendanceData),
  };
}

describe('GetEventAttendanceUseCase', () => {
  it('1. computes correct metrics when tickets and check-ins exist', async () => {
    const repo = makeMockRepo({
      byTicketType: [
        { ticketTypeId: 'tt-1', ticketTypeName: 'Inteira', totalIssued: 100, totalAdmitted: 60 },
        { ticketTypeId: 'tt-2', ticketTypeName: 'Meia', totalIssued: 50, totalAdmitted: 27 },
      ],
      recentCheckIns: [
        {
          checkedInAt: new Date('2026-08-13T20:00:00Z'),
          ticketTypeName: 'Inteira',
          performedByUserId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        },
      ],
    });

    const useCase = new GetEventAttendanceUseCase(repo);
    const result = await useCase.execute('org-1', 'event-1');

    expect(result.totalIssued).toBe(150);
    expect(result.totalAdmitted).toBe(87);
    expect(result.totalRemaining).toBe(63);
    expect(result.attendanceRate).toBeCloseTo(58.0);
    expect(result.byTicketType).toHaveLength(2);
    expect(result.byTicketType[0]).toEqual({
      ticketTypeId: 'tt-1',
      ticketTypeName: 'Inteira',
      totalIssued: 100,
      totalAdmitted: 60,
    });
    expect(result.recentCheckIns).toHaveLength(1);
    // UUID 'a1b2c3d4-e5f6-...' → strip dashes → first 8 = 'a1b2c3d4'
    expect(result.recentCheckIns[0]!.performedByUserId).toBe('a1b2c3d4');
    expect(result.recentCheckIns[0]!.ticketTypeName).toBe('Inteira');
  });

  it('2. returns zeros when there are no tickets or check-ins', async () => {
    const repo = makeMockRepo({
      byTicketType: [],
      recentCheckIns: [],
    });

    const useCase = new GetEventAttendanceUseCase(repo);
    const result = await useCase.execute('org-1', 'event-empty');

    expect(result.totalIssued).toBe(0);
    expect(result.totalAdmitted).toBe(0);
    expect(result.totalRemaining).toBe(0);
    expect(result.attendanceRate).toBe(0);
    expect(result.byTicketType).toEqual([]);
    expect(result.recentCheckIns).toEqual([]);
  });

  it('3. throws NotFoundException when event does not belong to organization', async () => {
    const repo = makeMockRepo(null);

    const useCase = new GetEventAttendanceUseCase(repo);
    await expect(useCase.execute('other-org', 'event-1')).rejects.toThrow(NotFoundException);
  });

  it('4. formats performedByUserId as 8-char prefix (digits from UUID without dashes)', async () => {
    const repo = makeMockRepo({
      byTicketType: [],
      recentCheckIns: [
        {
          checkedInAt: new Date('2026-08-13T20:00:00Z'),
          ticketTypeName: 'VIP',
          performedByUserId: 'ffffffff-aaaa-bbbb-cccc-dddddddddddd',
        },
      ],
    });

    const useCase = new GetEventAttendanceUseCase(repo);
    const result = await useCase.execute('org-1', 'event-1');

    expect(result.recentCheckIns[0]!.performedByUserId).toBe('ffffffff');
  });

  it('5. uses "sistema" when performedByUserId is null', async () => {
    const repo = makeMockRepo({
      byTicketType: [],
      recentCheckIns: [
        {
          checkedInAt: new Date('2026-08-13T20:00:00Z'),
          ticketTypeName: 'Inteira',
          performedByUserId: null,
        },
      ],
    });

    const useCase = new GetEventAttendanceUseCase(repo);
    const result = await useCase.execute('org-1', 'event-1');

    expect(result.recentCheckIns[0]!.performedByUserId).toBe('sistema');
  });
});
