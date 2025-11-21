import path, {dirname} from 'path';
import {fileURLToPath} from 'url';

export const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
export const LOCAL_OPKG_DATA_DIR = path.join(SCRIPTS_DIR, 'opkg');
export const ROOT_DIR = path.resolve(path.join(SCRIPTS_DIR, '..'));
export const ENV_FILE = path.join(ROOT_DIR, '.env');

export const SSH_USER = 'root'; // default opkg username

export const PACKAGES_LIST = [
  'lighttpd',
  'lighttpd-mod-alias',
  'lighttpd-mod-proxy',
  'lighttpd-mod-rewrite',
  'lighttpd-mod-cgi',
  'ttyd',
  'daemonize',
];

export const LIGHTTPD_CONF_TEMPLATE = 'template.lighttpd.conf';
export const LIGHTTPD_CONF = 'lighttpd.conf';
export const LIGHTTPD_CONF_REMOTE_DIR = '/opt/etc/lighttpd';
