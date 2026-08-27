import { InvalidCursorError } from '../event.errors';

export interface PublicEventCursor {
  startsAt: Date;
  id: string;
}

/**
 * Opaque keyset cursor for the public catalog. Encodes `startsAt|id` as
 * base64url so clients treat it as an opaque token and cannot infer ordering
 * internals.
 */
export function encodePublicCursor(row: PublicEventCursor): string {
  return Buffer.from(`${row.startsAt.toISOString()}|${row.id}`).toString('base64url');
}

export function decodePublicCursor(cursor: string): PublicEventCursor {
  const decoded = Buffer.from(cursor, 'base64url').toString('utf-8');
  const separator = decoded.indexOf('|');
  if (separator === -1) throw new InvalidCursorError();

  const startsAt = new Date(decoded.slice(0, separator));
  const id = decoded.slice(separator + 1);
  if (Number.isNaN(startsAt.getTime()) || id.length === 0) throw new InvalidCursorError();

  return { startsAt, id };
}
