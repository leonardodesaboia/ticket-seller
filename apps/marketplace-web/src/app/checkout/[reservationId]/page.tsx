import { CheckoutPage } from '@/features/checkout';

export const dynamic = 'force-dynamic';

export default async function CheckoutRoute({ params }: { params: Promise<{ reservationId: string }> }) {
  const { reservationId } = await params;
  return <CheckoutPage reservationId={reservationId} />;
}
