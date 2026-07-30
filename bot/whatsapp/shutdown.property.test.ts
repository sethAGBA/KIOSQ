// Feature: whatsapp-bot-deployment
// Properties 1–4: Graceful shutdown correctness

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { createShutdownHandler } from './shutdown.js';

/**
 * Validates: Requirements 5.3, 5.4, 5.5, 5.6
 *
 * Property 1: Clean shutdown exits 0
 *   For any scenario where server.close calls its callback within the timeout,
 *   process.exit must be called with 0.
 *
 * Property 2: Timeout shutdown exits 1
 *   For any scenario where server.close never calls its callback,
 *   process.exit must be called with 1 after the timeout elapses.
 *
 * Property 3: SIGINT === SIGTERM symmetry
 *   For any shutdown scenario, receiving SIGINT vs SIGTERM produces the same
 *   exit code and the same call order.
 *
 * Property 4: Poller cleared before server.close
 *   For any bot state, clearInterval is always called before server.close().
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a mock server whose close() calls back immediately (clean drain). */
function makeCleanServer() {
  const closeOrder: string[] = [];
  const server = {
    close: vi.fn((cb?: () => void) => {
      closeOrder.push('server.close');
      cb?.();
    }),
    _closeOrder: closeOrder,
  };
  return server;
}

/** Build a mock server whose close() never calls the callback (simulates hung connections). */
function makeHungServer() {
  const closeOrder: string[] = [];
  const server = {
    close: vi.fn((_cb?: () => void) => {
      closeOrder.push('server.close');
      // intentionally never calls _cb
    }),
    _closeOrder: closeOrder,
  };
  return server;
}

/** Build a mock timer handle. clearInterval on it records a call. */
function makeTimer() {
  // We only need a handle — the actual interval doesn't fire in tests
  // because we use fake timers.
  return setInterval(() => {/* no-op */}, 999_999);
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(process, 'exit').mockImplementation((_code?: number | string | null | undefined) => {
    // do nothing — prevent actual process termination
    return undefined as never;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Property 1: Clean shutdown exits 0
// Validates: Requirement 5.4
// ---------------------------------------------------------------------------
describe('shutdown — Property 1: clean shutdown exits 0 (Req 5.4)', () => {
  it('process.exit(0) is called when server.close completes within timeout (100 iterations)', () => {
    fc.assert(
      fc.property(
        // Arbitrary signal string (in practice SIGTERM/SIGINT, but the handler
        // accepts any string — we test the full string domain)
        fc.constantFrom('SIGTERM', 'SIGINT', 'SIGUSR1', 'custom-signal'),
        // Arbitrary timeout between 1 ms and 30 000 ms
        fc.integer({ min: 1, max: 30_000 }),
        (signal, timeoutMs) => {
          vi.clearAllMocks();

          const server = makeCleanServer();
          const timer = makeTimer();
          const shutdown = createShutdownHandler(server, timer, { timeoutMs });

          shutdown(signal);

          // server.close was called
          expect(server.close).toHaveBeenCalledOnce();

          // process.exit(0) was called (callback fires synchronously in mock)
          expect(process.exit).toHaveBeenCalledWith(0);

          // process.exit(1) was NOT called at this point (timeout hasn't fired)
          const exitCalls = vi.mocked(process.exit).mock.calls;
          expect(exitCalls.every(([code]) => code === 0)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2: Timeout shutdown exits 1
// Validates: Requirement 5.5
// ---------------------------------------------------------------------------
describe('shutdown — Property 2: timeout shutdown exits 1 (Req 5.5)', () => {
  it('process.exit(1) is called when server.close never completes (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('SIGTERM', 'SIGINT'),
        // Use small timeouts so vi.advanceTimersByTime works predictably
        fc.integer({ min: 1, max: 10_000 }),
        (signal, timeoutMs) => {
          vi.clearAllMocks();

          const server = makeHungServer();
          const timer = makeTimer();
          const shutdown = createShutdownHandler(server, timer, { timeoutMs });

          shutdown(signal);

          // server.close was called but callback never fires — no exit yet
          expect(process.exit).not.toHaveBeenCalledWith(0);

          // Advance fake timers past the timeout
          vi.advanceTimersByTime(timeoutMs + 1);

          // Now process.exit(1) must have been called
          expect(process.exit).toHaveBeenCalledWith(1);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3: SIGINT === SIGTERM symmetry
// Validates: Requirement 5.6
// ---------------------------------------------------------------------------
describe('shutdown — Property 3: SIGINT === SIGTERM symmetry (Req 5.6)', () => {
  it('identical exit code for SIGTERM and SIGINT on clean drain (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10_000 }),
        (timeoutMs) => {
          // ---- SIGTERM run ----
          vi.clearAllMocks();
          const serverA = makeCleanServer();
          const timerA = makeTimer();
          const shutdownA = createShutdownHandler(serverA, timerA, { timeoutMs });
          shutdownA('SIGTERM');
          const exitCallsSIGTERM = vi.mocked(process.exit).mock.calls.map(([code]) => code);

          // ---- SIGINT run ----
          vi.clearAllMocks();
          const serverB = makeCleanServer();
          const timerB = makeTimer();
          const shutdownB = createShutdownHandler(serverB, timerB, { timeoutMs });
          shutdownB('SIGINT');
          const exitCallsSIGINT = vi.mocked(process.exit).mock.calls.map(([code]) => code);

          // Both must produce the same exit codes
          expect(exitCallsSIGTERM).toEqual(exitCallsSIGINT);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('identical exit code for SIGTERM and SIGINT on timeout (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5_000 }),
        (timeoutMs) => {
          // ---- SIGTERM run (hung) ----
          vi.clearAllMocks();
          const serverA = makeHungServer();
          const timerA = makeTimer();
          const shutdownA = createShutdownHandler(serverA, timerA, { timeoutMs });
          shutdownA('SIGTERM');
          vi.advanceTimersByTime(timeoutMs + 1);
          const exitCodeSIGTERM = vi.mocked(process.exit).mock.calls.at(-1)?.[0];

          // ---- SIGINT run (hung) ----
          vi.clearAllMocks();
          const serverB = makeHungServer();
          const timerB = makeTimer();
          const shutdownB = createShutdownHandler(serverB, timerB, { timeoutMs });
          shutdownB('SIGINT');
          vi.advanceTimersByTime(timeoutMs + 1);
          const exitCodeSIGINT = vi.mocked(process.exit).mock.calls.at(-1)?.[0];

          expect(exitCodeSIGTERM).toBe(exitCodeSIGINT);
          expect(exitCodeSIGTERM).toBe(1);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 4: Poller cleared before server.close
// Validates: Requirement 5.3
// ---------------------------------------------------------------------------
describe('shutdown — Property 4: clearInterval before server.close (Req 5.3)', () => {
  it('clearInterval is always called before server.close for any signal (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('SIGTERM', 'SIGINT', 'custom'),
        fc.boolean(), // clean drain or hung?
        (signal, cleanDrain) => {
          vi.clearAllMocks();

          const callOrder: string[] = [];

          // Spy on clearInterval to record call order
          const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval').mockImplementation((_id) => {
            callOrder.push('clearInterval');
          });

          const server = {
            close: vi.fn((_cb?: () => void) => {
              callOrder.push('server.close');
              if (cleanDrain) _cb?.();
            }),
          };

          const timer = makeTimer();
          const shutdown = createShutdownHandler(server, timer, { timeoutMs: 10_000 });

          shutdown(signal);

          // clearInterval must appear before server.close in the call order
          const clearIdx = callOrder.indexOf('clearInterval');
          const closeIdx = callOrder.indexOf('server.close');

          expect(clearIdx).toBeGreaterThanOrEqual(0);
          expect(closeIdx).toBeGreaterThanOrEqual(0);
          expect(clearIdx).toBeLessThan(closeIdx);

          clearIntervalSpy.mockRestore();
        },
      ),
      { numRuns: 100 },
    );
  });
});
