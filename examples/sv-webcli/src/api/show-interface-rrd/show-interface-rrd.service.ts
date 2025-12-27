import {RciQuery} from '@rci-tools/core';
import {Observable, map} from 'rxjs';
import {RciService} from '../rci.service';
import {ShowInterfaceRrdRequest} from './show-interface-rrd.request.ts';
import {ShowInterfaceRrdResponse} from './show-interface-rrd.response.ts';
import {showInterfaceRrdResponseSchema} from './show-interface-rrd.schema.ts';

export class ShowInterfaceRrdService {
  constructor(
    private readonly rciService: RciService,
  ) {}

  public read(request: ShowInterfaceRrdRequest): Observable<ShowInterfaceRrdResponse> {
    const query: RciQuery = {path: 'show.interface.rrd', data: request};

    return this.rciService.queue(query)
      .pipe(
        map((response) => showInterfaceRrdResponseSchema.parse(response)),
      );
  }
}
