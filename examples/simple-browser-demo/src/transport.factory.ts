import {FetchTransport, HttpTransport, XHRTransport} from '@rci-tools/core';

export const createTransport = (transportName?: string): HttpTransport => {
  return transportName === 'xhr'
    ? new XHRTransport()
    : new FetchTransport();
};
