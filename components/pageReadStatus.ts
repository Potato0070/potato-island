export type ReadFailure = 'error' | 'missing' | 'login' | 'denied';

export function readFailureFrom(error: unknown): ReadFailure {
  const failure = error as { code?: string; status?: number; name?: string } | null;
  if (failure?.status === 401 || failure?.name === 'AuthSessionMissingError') return 'login';
  if (failure?.status === 403 || failure?.code === '42501') return 'denied';
  // With unique-ID lookups, no visible row may mean deleted content or RLS.
  if (failure?.code === 'PGRST116' || failure?.code === '22P02') return 'missing';
  return 'error';
}

export function validPageId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
