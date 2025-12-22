import {RciService} from '../rci.service.ts';
import {Observable, map} from 'rxjs';
import {RciQuery} from 'rci-manager';
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

  public read(maxLines?: number): Observable<ShowLogResponse> {
    const data = maxLines ? {'max-lines': maxLines} : {};

    const query: RciQuery = {
      path: this.path,
      data,
    };

    const task = this.rciService.queueBackgroundProcess(query);

    return task.data$
      .pipe(
        map((response) => showLogResponseSchema.parse(response)),
      );
  }
}
