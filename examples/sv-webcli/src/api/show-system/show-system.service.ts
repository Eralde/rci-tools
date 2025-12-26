import {RciQuery} from '@rci-tools/base';
import {Observable, map} from 'rxjs';
import {RciService} from '../rci.service';
import {ShowSystemResponse} from './show-system.response.ts';
import {showSystemResponseSchema} from './show-system.schema.ts';

export class ShowSystemService {
  constructor(
    private readonly rciService: RciService,
  ) {}

  public read(): Observable<ShowSystemResponse> {
    const query: RciQuery = {
      path: 'show.system',
    };

    return this.rciService.queue(query)
      .pipe(
        map((response) => showSystemResponseSchema.parse(response)),
      );
  }
}
