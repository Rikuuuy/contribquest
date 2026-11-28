// A recording stand-in for CanvasRenderingContext2D (Node has no canvas). Every method call is logged with the
// fillStyle, strokeStyle, and lineWidth in effect, so tests can check what was drawn and in which colour.

export type DrawCall = { name: string; args: unknown[]; fillStyle: unknown; strokeStyle: unknown; lineWidth: number };

export type RecordingCtx = CanvasRenderingContext2D & { calls: DrawCall[] };

export function recordingCtx(): RecordingCtx {
  const calls: DrawCall[] = [];
  const props: Record<string, unknown> = { fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1 };
  const gradient = { addColorStop: () => undefined };
  const target = { calls } as Record<string | symbol, unknown>;
  return new Proxy(target, {
    get(t, key) {
      if (key === 'calls') return calls;
      if (typeof key === 'string' && key in props) return props[key];
      if (key in t) return t[key];
      return (...args: unknown[]) => {
        calls.push({
          name: String(key),
          args,
          fillStyle: props['fillStyle'],
          strokeStyle: props['strokeStyle'],
          lineWidth: props['lineWidth'] as number,
        });
        if (key === 'createLinearGradient' || key === 'createRadialGradient') return gradient;
        if (key === 'measureText') return { width: String(args[0]).length * 8 };
        return undefined;
      };
    },
    set(_t, key, value) {
      props[String(key)] = value;
      return true;
    },
  }) as unknown as RecordingCtx;
}

/** Calls named `name`, optionally only those drawn with `fill` as fillStyle. */
export const callsOf = (ctx: RecordingCtx, name: string, fill?: string): DrawCall[] =>
  ctx.calls.filter((c) => c.name === name && (fill === undefined || c.fillStyle === fill));

/** Every string passed to fillText. */
export const textsOf = (ctx: RecordingCtx): string[] => callsOf(ctx, 'fillText').map((c) => String(c.args[0]));
