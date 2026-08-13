import { AttendanceDashboard } from '@/features/attendance/components/AttendanceDashboard';

interface PageProps {
  params: Promise<{ organizationId: string; eventId: string }>;
}

export default async function Page({ params }: PageProps) {
  const { organizationId, eventId } = await params;
  return <AttendanceDashboard orgId={organizationId} eventId={eventId} />;
}
