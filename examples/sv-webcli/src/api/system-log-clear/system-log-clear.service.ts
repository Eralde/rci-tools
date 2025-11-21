import {RciQuery} from 'rci-manager';
import {Observable} from 'rxjs';
import {RciService} from '../rci.service';

export class SystemLogClearService {
  constructor(
    private readonly rciService: RciService,
  ) {}

  public perform(): Observable<unknown> {
    const query: RciQuery = {path: 'system.log.clear'};

    return this.rciService.execute(query);
  }
}
