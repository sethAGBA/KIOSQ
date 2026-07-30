/**
 * shutdown.ts — Graceful shutdown handler factory for the WhatsApp bot.
 *
 * Extracted from main() in index.ts so the logic can be unit-tested
 * independently of the full bot startup sequence.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
 */

import type * as http from 'node:http';

export interface ShutdownDeps {
  /** How long (ms) to wait for server.close before force-exiting. Default 10 000. */
  timeoutMs?: number;
}

/**
 * Creates a shutdown handler that, when called with a signal name:
 *  1. Logs the signal received
 *  2. Calls clearInterval(timer) — stops the poller (Req 5.3)
 *  3. Calls server.close(cb) — drains connections then exits 0 (Req 5.4)
 *  4. Sets a fallback setTimeout that exits 1 after timeoutMs (Req 5.5)
 *
 * Both SIGTERM and SIGINT produce identical behaviour (Req 5.6).
 */
export function createShutdownHandler(
  server: Pick<http.Server, 'close'>,
  timer: ReturnType<typeof setInterval>,
  deps: ShutdownDeps = {},
): (signal: string) => void {
  const timeoutMs = deps.timeoutMs ?? 10_000;

  return function shutdown(signal: string): void {
    console.log(`[main] Arrêt en cours (${signal})…`);

    clearInterval(timer);
    console.log('[main] Poller arrêté');

    server.close(() => {
      console.log('[main] Serveur HTTP fermé — exit 0');
      process.exit(0);
    });

    setTimeout(() => {
      console.log('[main] Timeout arrêt — exit forcé');
      process.exit(1);
    }, timeoutMs);
  };
}
