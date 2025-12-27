import {RciQuery} from '@rci-tools/core';
import {Observable, map} from 'rxjs';
import {RciService} from '../rci.service';
import {showInterfaceResponseSchema} from './show-interface.schema.ts';
import {ShowInterfaceRequest} from './show-interface.request.ts';
import {ShowInterfaceResponse} from './show-interface.response.ts';

export class ShowInterfaceService {
  constructor(
    private readonly rciService: RciService,
  ) {}

  public read(request: ShowInterfaceRequest = {}): Observable<ShowInterfaceResponse> {
    const query: RciQuery = {path: 'show.interface', data: request};

    return this.rciService.queue(query)
      .pipe(
        map((response) => showInterfaceResponseSchema.parse(response)),
      );
  }
}
