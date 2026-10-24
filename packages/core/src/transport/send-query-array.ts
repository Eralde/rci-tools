import {type Observable, map} from 'rxjs';
import type {GenericObject} from '../type.utils';
import type {BaseHttpResponse, HttpTransport} from './http.transport';
import {RciHttpError} from './errors/rci-http-error';

export const sendQueryArray = (
  transport: HttpTransport<BaseHttpResponse>,
  url: string,
  queryArray: GenericObject[],
): Observable<GenericObject[]> => {
  return transport.post(url, queryArray)
    .pipe(
      map(response => {
        if (!Array.isArray(response.data)) {
          throw new RciHttpError('Malformed RCI response: expected an array', {
            status: response.status,
            response,
          });
        }

        return response.data as GenericObject[];
      }),
    );
};
