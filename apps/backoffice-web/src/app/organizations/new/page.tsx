'use client';

import { useRouter } from 'next/navigation';
import { CreateOrganizationForm } from '../../../features/organizations';
import type { Organization } from '../../../features/organizations';

export default function NewOrganizationPage() {
  const router = useRouter();

  function handleSuccess(org: Organization) {
    router.push(`/organizations/${org.id}/events/new`);
  }

  return (
    <main className="mx-auto max-w-lg p-8">
      <h1 className="mb-6 text-2xl font-bold text-foreground">Nova organização</h1>
      <CreateOrganizationForm onSuccess={handleSuccess} />
    </main>
  );
}
