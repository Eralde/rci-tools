import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {RciQuery} from '@rci-tools/core';
import {RciService} from '@core/transport';
import {EmptyObject} from '@core/utils/types';

export abstract class BaseActionService<Response, Request extends EmptyObject = EmptyObject> {
  constructor(
    protected rciService: RciService,
    protected path: string,
    protected defaultRequestData: Request = {} as Request,
  ) {
  }

  public execute(data: Request = this.defaultRequestData): Observable<Response> {
    const query: RciQuery = {path: this.path, extractDataByPath: true};

    if (data) {
      query.data = data;
    } else {
      query.data = {};
    }

    return this.rciService.queue(query)
      .pipe(
        map((response) => this.transformResponse(response)),
      );
  }

  public setDefaultReadData(data: Request): void {
    this.defaultRequestData = data;
  }

  protected transformResponse(response: unknown): Response {
    return response as Response;
  }
}
