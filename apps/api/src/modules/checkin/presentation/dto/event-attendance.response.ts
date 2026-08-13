export interface AttendanceByTicketTypeDto {
  ticketTypeId: string;
  ticketTypeName: string;
  totalIssued: number;
  totalAdmitted: number;
}

export interface RecentCheckInDto {
  checkedInAt: string; // ISO 8601
  ticketTypeName: string;
  performedByUserId: string; // 8-char prefix or "sistema"
}

export interface EventAttendanceResponseDto {
  totalIssued: number;
  totalAdmitted: number;
  totalRemaining: number;
  attendanceRate: number;
  byTicketType: AttendanceByTicketTypeDto[];
  recentCheckIns: RecentCheckInDto[];
}
