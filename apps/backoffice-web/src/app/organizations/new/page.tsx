'use client';

import { useRouter } from 'next/navigation';
import { CreateOrganizationForm } from '../../../features/organizations';
import type { Organization } from '../../../features/organizations';

const DEV_USER_ID = process.env['NEXT_PUBLIC_DEV_USER_ID'] ?? '';

export default function NewOrganizationPage() {
  const router = useRouter();

  function handleSuccess(org: Organization) {
    router.push(`/organizations/${org.id}/events/new`);
  }

  return (
    <main className="mx-auto max-w-lg p-8">
      <h1 className="mb-6 text-2xl font-bold text-foreground">Nova organização</h1>
      <CreateOrganizationForm devUserId={DEV_USER_ID} onSuccess={handleSuccess} />
    </main>
  );
}
