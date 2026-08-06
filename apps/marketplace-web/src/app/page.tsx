import { CatalogHome } from '@/features/public-event-catalog';
import { listPublicEvents } from '@/shared/api/public-events.api';

// The catalog is backed by a live API (cached 60s at the fetch layer), so it is
// rendered per-request rather than prerendered at build time.
export const dynamic = 'force-dynamic';

export default async function Page() {
  const { data } = await listPublicEvents({ limit: 20 });
  return <CatalogHome events={data} />;
}
