import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const botDir = dirname(fileURLToPath(import.meta.url));
const parentEnv = resolve(botDir, '../.env.local');
const localEnv = resolve(botDir, '.env');

// Parent first, then bot/.env overrides
if (existsSync(parentEnv)) config({ path: parentEnv });
if (existsSync(localEnv)) config({ path: localEnv, override: true });
