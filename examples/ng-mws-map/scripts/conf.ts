import path, {dirname} from 'path';
import {fileURLToPath} from 'url';

export const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(path.join(SCRIPTS_DIR, '..'));
