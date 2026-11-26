export type Launch =
  | { kind: 'demo' }
  | { kind: 'user'; username: string; friend: string | null }
  | { kind: 'challenge'; friend: string }
  | { kind: 'none' };

/** Reads the launch URL's query string. Precedence: demo > u > vs > none. */
export function parseLaunch(search: string): Launch {
  const params = new URLSearchParams(search);
  if (params.has('demo')) return { kind: 'demo' };
  const u = params.get('u');
  const vs = params.get('vs');
  if (u) return { kind: 'user', username: u, friend: vs ? vs : null };
  if (vs) return { kind: 'challenge', friend: vs };
  return { kind: 'none' };
}
