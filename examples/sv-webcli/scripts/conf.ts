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

// CLI argument option names
export const ARG_DEVICE_ADDR = 'device-addr';
export const ARG_SSH_HOST = 'ssh-host';
export const ARG_SSH_PORT = 'ssh-port';
export const ARG_SSH_KEY = 'ssh-key';
export const ARG_HTTP_PORT = 'http-port';
export const ARG_REMOTE_WWW_ROOT = 'remote-www-root';
export const ARG_TTYD_PORT = 'ttyd-port';
export const ARG_TTYD_SCRIPTS_DIR = 'ttyd-scripts-dir';

// Map CLI option names to environment variable names
export const OPTION_TO_ENV: Record<string, string> = {
  [ARG_DEVICE_ADDR]: 'DEVICE_ADDR',
  [ARG_SSH_HOST]: 'SSH_HOST',
  [ARG_SSH_PORT]: 'SSH_PORT',
  [ARG_SSH_KEY]: 'SSH_KEY',
  [ARG_HTTP_PORT]: 'HTTP_PORT',
  [ARG_REMOTE_WWW_ROOT]: 'REMOTE_WWW_ROOT',
  [ARG_TTYD_PORT]: 'TTYD_PORT',
  [ARG_TTYD_SCRIPTS_DIR]: 'TTYD_SCRIPTS_DIR',
};

// Map environment variable names to CLI option names
export const ENV_TO_OPTION: Record<string, string> = Object.fromEntries(
  Object.entries(OPTION_TO_ENV).map(([key, value]) => [value, key]),
);
