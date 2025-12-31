import {RciService} from '../rci.service.ts';
import {Observable, map} from 'rxjs';
import {RciBackgroundProcess, RciQuery} from '@rci-tools/core';
import {ShowLogResponse} from './show-log.response.ts';
import {showLogResponseSchema} from './show-log.schema.ts';

export class ShowLogService {
  protected path: string = 'show.log';

  constructor(
    private readonly rciService: RciService,
  ) {}

  public readOnce(maxLines?: number): Observable<ShowLogResponse> {
    const data = maxLines ? {'max-lines': maxLines} : {};

    const query: RciQuery = {
      path: this.path,
      data: {...data, once: true},
    };

    return this.rciService.queue(query)
      .pipe(
        map((response) => showLogResponseSchema.parse(response)),
      );
  }

  public queueBackgroundProcess(maxLines?: number): RciBackgroundProcess {
    const data = maxLines ? {'max-lines': maxLines} : {};

    const query: RciQuery = {
      path: this.path,
      data,
    };

    return this.rciService.queueBackgroundProcess(query);
  }
}
