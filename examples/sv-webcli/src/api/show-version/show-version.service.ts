import {RciQuery} from 'rci-manager';
import {Observable, map} from 'rxjs';
import {RciService} from '../rci.service';
import {ShowVersionResponse} from './show-version.response.ts';
import {showVersionResponseSchema} from './show-version.schema.ts';

export class ShowVersionService {
  constructor(
    private readonly rciService: RciService,
  ) {}

  public read(): Observable<ShowVersionResponse> {
    const query: RciQuery = {
      path: 'show.version',
    };

    return this.rciService.queue(query)
      .pipe(
        map((response) => showVersionResponseSchema.parse(response)),
      );
  }
}
