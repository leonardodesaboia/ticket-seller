import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  CHECK_IN_REPOSITORY,
  ICheckInRepository,
} from '../../domain/ports/check-in-repository.port';

export interface AttendanceByTicketType {
  ticketTypeId: string;
  ticketTypeName: string;
  totalIssued: number;
  totalAdmitted: number;
}

export interface RecentCheckIn {
  checkedInAt: Date;
  ticketTypeName: string;
  performedByUserId: string; // 8-char prefix or "sistema"
}

export interface GetEventAttendanceOutput {
  totalIssued: number;
  totalAdmitted: number;
  totalRemaining: number;
  attendanceRate: number; // 0 when totalIssued = 0
  byTicketType: AttendanceByTicketType[];
  recentCheckIns: RecentCheckIn[];
}

@Injectable()
export class GetEventAttendanceUseCase {
  constructor(
    @Inject(CHECK_IN_REPOSITORY)
    private readonly checkInRepo: ICheckInRepository,
  ) {}

  async execute(organizationId: string, eventId: string): Promise<GetEventAttendanceOutput> {
    const data = await this.checkInRepo.getEventAttendance(organizationId, eventId);

    if (data === null) {
      throw new NotFoundException('Event not found for this organization');
    }

    const byTicketType: AttendanceByTicketType[] = data.byTicketType.map((row) => ({
      ticketTypeId: row.ticketTypeId,
      ticketTypeName: row.ticketTypeName,
      totalIssued: row.totalIssued,
      totalAdmitted: row.totalAdmitted,
    }));

    const totalIssued = byTicketType.reduce((sum, t) => sum + t.totalIssued, 0);
    const totalAdmitted = byTicketType.reduce((sum, t) => sum + t.totalAdmitted, 0);
    const totalRemaining = totalIssued - totalAdmitted;
    const attendanceRate = totalIssued === 0 ? 0 : (totalAdmitted / totalIssued) * 100;

    const recentCheckIns: RecentCheckIn[] = data.recentCheckIns.map((row) => ({
      checkedInAt: row.checkedInAt,
      ticketTypeName: row.ticketTypeName,
      performedByUserId: row.performedByUserId
        ? row.performedByUserId.replace(/-/g, '').slice(0, 8)
        : 'sistema',
    }));

    return {
      totalIssued,
      totalAdmitted,
      totalRemaining,
      attendanceRate,
      byTicketType,
      recentCheckIns,
    };
  }
}
