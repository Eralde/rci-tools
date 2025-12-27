import {RciQuery} from '@rci-tools/core';
import {Observable, map} from 'rxjs';
import {RciService} from '../rci.service';
import {ShowSystemRrdMemoryRequest} from './show-system-rrd-memory.request.ts';
import {showSystemRrdMemoryResponseSchema} from './show-system-rrd-memory.schema.ts';
import {ShowSystemRrdMemoryResponse} from './show-system-rrd-memory.response.ts';

export class ShowSystemRrdMemoryService {
  constructor(
    private readonly rciService: RciService,
  ) {}

  public read(request: ShowSystemRrdMemoryRequest): Observable<ShowSystemRrdMemoryResponse> {
    const query: RciQuery = {path: 'show.system.rrd.memory', data: request};

    return this.rciService.queue(query)
      .pipe(
        map((response) => showSystemRrdMemoryResponseSchema.parse(response)),
      );
  }
}
