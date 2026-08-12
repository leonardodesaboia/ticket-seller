import { CheckInPage } from '@/features/checkin/components/CheckInPage';

interface PageProps {
  params: Promise<{ organizationId: string; eventId: string }>;
}

export default async function Page({ params }: PageProps) {
  const { organizationId, eventId } = await params;
  return <CheckInPage orgId={organizationId} eventId={eventId} />;
}
