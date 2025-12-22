import {RciQuery} from 'rci-manager';
import {Observable, map} from 'rxjs';
import {RciService} from '../rci.service';
import {ShowInterfaceStatRequest} from './show-interface-stat.request.ts';
import {ShowInterfaceStatResponse} from './show-interface-stat.response.ts';
import {showInterfaceStatResponseSchema} from './show-interface-stat.schema.ts';

export class ShowInterfaceStatApiService {
  constructor(
    private readonly rciService: RciService,
  ) {}

  public read(request: ShowInterfaceStatRequest): Observable<ShowInterfaceStatResponse> {
    const query: RciQuery = {
      path: 'show.interface.stat',
      data: request,
    };

    return this.rciService.queue(query)
      .pipe(
        map((response) => showInterfaceStatResponseSchema.parse(response)),
      );
  }
}
