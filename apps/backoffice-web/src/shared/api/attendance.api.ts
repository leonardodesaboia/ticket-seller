import { API_BASE_URL } from './api-client';

function authHeaders(token: string): Record<string, string> {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export interface AttendanceByTicketType {
  ticketTypeId: string;
  ticketTypeName: string;
  totalIssued: number;
  totalAdmitted: number;
}

export interface RecentCheckIn {
  checkedInAt: string; // ISO 8601
  ticketTypeName: string;
  performedByUserId: string;
}

export interface AttendanceResponse {
  totalIssued: number;
  totalAdmitted: number;
  totalRemaining: number;
  attendanceRate: number;
  byTicketType: AttendanceByTicketType[];
  recentCheckIns: RecentCheckIn[];
}

export async function getEventAttendance(
  orgId: string,
  eventId: string,
  token: string,
): Promise<AttendanceResponse> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/organizations/${encodeURIComponent(orgId)}/events/${encodeURIComponent(eventId)}/attendance`,
    { headers: authHeaders(token) },
  );
  if (!res.ok) throw new Error(`attendance fetch failed: ${res.status}`);
  return res.json() as Promise<AttendanceResponse>;
}
