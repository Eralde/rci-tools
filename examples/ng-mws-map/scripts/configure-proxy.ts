import * as fs from 'node:fs';
import {fileURLToPath} from 'url';
import path from 'path';

const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(path.join(SCRIPTS_DIR, '..'));
const LOCAL_PROXY_CONFIG_FILENAME = path.join(ROOT_DIR, 'proxy.conf.js');

const DEFAULT_PROXY_CONFIG = [
  {
    context: [
      '/auth',
      '/rci',
      '/fui',

      '/ndmConstants.json',
      '/ndmContacts.json',
      '/ndmFeatures.json',
      '/ndmLanguages.json',
    ],
    target: 'http://192.168.1.1',
    secure: false,
    changeOrigin: true,
  },
];

const getProxyConfigFileBody = (
  config: Record<string, any>,
  deviceAddress: string,
): string => {
  // Ensure deviceAddress has a protocol
  const target = deviceAddress.startsWith('http://') || deviceAddress.startsWith('https://')
    ? deviceAddress
    : `http://${deviceAddress}`;
  config[0].target = target;

  const configStr = JSON.stringify(config, null, 2);

  const host = target.replace(/http(s)?:\/\//, '').replace(/\/$/, '');
  const origin = target;
  const referer = target;

  // Due to CSP we need to set the Host, Origin and Referer headers to the device address
  //
  // @see https://github.com/chimurai/http-proxy-middleware?tab=readme-ov-file#http-proxy-events
  // @see [since Angular v18] https://github.com/angular/angular-cli/issues/28073
  return `
const config = ${configStr};

config[0].configure = (proxy) => {
  proxy.on('proxyReq', (proxyReq) => {
    proxyReq.setHeader('Host', '${host}');
    proxyReq.setHeader('Origin', '${origin}');
    proxyReq.setHeader('Referer','${referer}');
  });
};

module.exports = config;
`;
};

export const updateLocalProxyConfiguration = (deviceAddress: string): void => {
  const proxyLocalConfig = getProxyConfigFileBody(DEFAULT_PROXY_CONFIG, deviceAddress);

  fs.writeFileSync(LOCAL_PROXY_CONFIG_FILENAME, proxyLocalConfig);
};

updateLocalProxyConfiguration('192.168.10.1');
