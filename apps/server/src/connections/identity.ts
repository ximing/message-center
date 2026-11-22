import type { EgressProvider } from '@mc/dto';

export interface RemoteIdentity {
  remoteUserId: string;
  remoteDisplayName: string | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function stringField(record: Record<string, unknown> | null, key: string): string | null {
  if (!record) return null;
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function readRemoteIdentity(provider: EgressProvider, body: unknown): RemoteIdentity | null {
  const root = asRecord(body);
  if (!root) return null;
  if (provider === 'aimo') {
    if (typeof root.code === 'number' && root.code !== 0) return null;
    const data = asRecord(root.data);
    const uid = stringField(data, 'uid') ?? stringField(root, 'uid');
    if (!uid) return null;
    const name =
      stringField(data, 'nickname') ??
      stringField(data, 'displayName') ??
      stringField(root, 'nickname') ??
      stringField(root, 'displayName');
    return { remoteUserId: uid, remoteDisplayName: name };
  }
  const id = stringField(root, 'id');
  if (!id) return null;
  return { remoteUserId: id, remoteDisplayName: stringField(root, 'displayName') };
}

export function verifyPath(provider: EgressProvider): string {
  if (provider === 'vital') return '/api/v1/auth/me';
  if (provider === 'aimo') return '/api/v1/user/info';
  return '/api/auth/me';
}
