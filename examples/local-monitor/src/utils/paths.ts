import {dirname, join} from 'path';
import {fileURLToPath} from 'url';

export function appDataDir(): string {
  const cwd = dirname(fileURLToPath(import.meta.url));

  return join(cwd, '..', '..');
}
