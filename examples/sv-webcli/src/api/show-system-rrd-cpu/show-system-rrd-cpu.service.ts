import {RciQuery} from '@rci-tools/core';
import {Observable, map} from 'rxjs';
import {RciService} from '../rci.service';
import {ShowSystemRrdCpuRequest} from './show-system-rrd-cpu.request.ts';
import {showSystemRrdCpuResponseSchema} from './show-system-rrd-cpu.schema.ts';
import {ShowSystemRrdCpuResponse} from './show-system-rrd-cpu.response.ts';

export class ShowSystemRrdCpuService {
  constructor(
    private readonly rciService: RciService,
  ) {}

  public read(request: ShowSystemRrdCpuRequest): Observable<ShowSystemRrdCpuResponse> {
    const query: RciQuery = {path: 'show.system.rrd.cpu', data: request};

    return this.rciService.queue(query)
      .pipe(
        map((response) => showSystemRrdCpuResponseSchema.parse(response)),
      );
  }
}
