import { AcceptTransferPage } from '@/features/transfer/components/AcceptTransferPage';

export default async function TransferAcceptPage({ params }: { params: Promise<{ claimToken: string }> }) {
  const { claimToken } = await params;
  return <AcceptTransferPage claimToken={claimToken} />;
}
