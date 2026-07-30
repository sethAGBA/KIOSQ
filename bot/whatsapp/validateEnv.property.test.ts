// Feature: whatsapp-commandes-bot, Property 10: validation env variables manquantes

import { describe, it, expect, vi, afterEach } from 'vitest';
import fc from 'fast-check';
import { validateWhatsappEnv } from './validateEnv.js';

/**
 * Validates: Requirements 10.1, 10.2
 *
 * Property 10: Validation d'environnement — rapport des variables manquantes
 *
 * For any non-empty subset of the 7 required environment variables that is
 * absent, validateWhatsappEnv() must call process.exit(1) and the combined
 * console.error output must contain the name of every missing variable.
 */

const REQUIRED_VARS = [
  'WHATSAPP_TOKEN',
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_APP_SECRET',
  'WHATSAPP_VERIFY_TOKEN',
  'BOT_JWT',
  'KIOSQ_API_URL',
  'GEMINI_API_KEY',
] as const;

type RequiredVar = (typeof REQUIRED_VARS)[number];

/**
 * Run validateWhatsappEnv() in isolation:
 * - Set only the provided present vars in process.env, clear the missing ones
 * - Intercept console.error and process.exit
 * - Returns the combined stderr output and whether process.exit(1) was called
 */
function runValidation(presentVars: readonly RequiredVar[]): {
  stderrOutput: string;
  exitCalled: boolean;
  exitCode: number | undefined;
} {
  // Save and restore relevant env vars
  const saved: Record<string, string | undefined> = {};
  for (const v of REQUIRED_VARS) {
    saved[v] = process.env[v];
    if ((presentVars as readonly string[]).includes(v)) {
      process.env[v] = 'test-value';
    } else {
      delete process.env[v];
    }
  }

  const stderrLines: string[] = [];
  const stderrSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    stderrLines.push(args.map(String).join(' '));
  });

  let exitCalled = false;
  let exitCode: number | undefined;
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: number | string | null) => {
    exitCalled = true;
    exitCode = typeof code === 'number' ? code : undefined;
    // Throw to prevent execution from continuing past this point
    throw new Error(`process.exit(${code})`);
  });

  try {
    validateWhatsappEnv();
  } catch {
    // Expected when process.exit mock throws to stop execution
  } finally {
    // Restore env vars
    for (const v of REQUIRED_VARS) {
      if (saved[v] === undefined) {
        delete process.env[v];
      } else {
        process.env[v] = saved[v];
      }
    }
    stderrSpy.mockRestore();
    exitSpy.mockRestore();
  }

  return { stderrOutput: stderrLines.join('\n'), exitCalled, exitCode };
}

describe('validateWhatsappEnv — Property 10: variables manquantes reportées (Req 10.1, 10.2)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it(
    "Property 10 — chaque variable manquante apparaît dans le message d'erreur (100 itérations)",
    () => {
      fc.assert(
        fc.property(
          // Generate a non-empty subset of vars that are MISSING (absent from env)
          fc.subarray([...REQUIRED_VARS], { minLength: 1 }),
          (missingVars) => {
            const presentVars = REQUIRED_VARS.filter(
              (v) => !(missingVars as string[]).includes(v),
            ) as RequiredVar[];

            const { stderrOutput, exitCalled, exitCode } = runValidation(presentVars);

            // process.exit(1) must be called when any required var is missing
            expect(exitCalled).toBe(true);
            expect(exitCode).toBe(1);

            // Every missing variable name must appear in the stderr output
            for (const varName of missingVars) {
              expect(stderrOutput).toContain(varName);
            }

            return true;
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it("toutes les variables présentes → pas d'erreur, pas de process.exit", () => {
    const { stderrOutput, exitCalled } = runValidation([...REQUIRED_VARS]);
    expect(exitCalled).toBe(false);
    expect(stderrOutput).toBe('');
  });
});
