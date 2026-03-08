import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

let loaded = false;

export function loadEnv() {
  if (loaded) return;

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const envPath = path.resolve(__dirname, '../../.env');
  dotenv.config({ path: envPath });
  loaded = true;
}

