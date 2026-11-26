// Map and combat logs, trimmed like the prototype's `log` and `clog`.
import { COMBAT_LOG_LINES, MAP_LOG_LINES } from './balance';

export function log(s: { log: string[] }, msg: string): void {
  s.log.push(msg);
  trimLog(s);
}

export function trimLog(s: { log: string[] }): void {
  if (s.log.length > MAP_LOG_LINES) s.log = s.log.slice(-MAP_LOG_LINES);
}

export function clog(f: { lines: string[] }, msg: string): void {
  f.lines.push(msg);
  if (f.lines.length > COMBAT_LOG_LINES) f.lines = f.lines.slice(-COMBAT_LOG_LINES);
}
