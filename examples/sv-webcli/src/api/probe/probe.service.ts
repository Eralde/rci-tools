import {RciQuery} from '@rci-tools/core';
import {Observable, map} from 'rxjs';
import {RciService} from '../rci.service';
import {ProbeResponse} from './probe.response.ts';
import {probeResponseSchema} from './probe.schema.ts';

export class ProbeService {
  constructor(
    private readonly rciService: RciService,
  ) {}

  public read(request: string): Observable<ProbeResponse> {
    const query: RciQuery = {path: 'probe', data: request};

    return this.rciService.queue(query)
      .pipe(
        map((response) => probeResponseSchema.parse(response)),
      );
  }
}
