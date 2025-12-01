import {Injectable} from '@angular/core';
import {Observable, forkJoin, map} from 'rxjs';
import {ShowMwsMemberActionService} from '@api/show-mws';
import {ShowVersionActionService} from '@api/show-version';
import {ShowIdentificationActionService} from '@api/show-identification';
import {MwsNode} from './mws.types';

@Injectable({
  providedIn: 'root',
})
export class MwsService {
  constructor(
    protected showVersion: ShowVersionActionService,
    protected showIdentification: ShowIdentificationActionService,
    protected showMwsMember: ShowMwsMemberActionService,
  ) {
  }

  public getTree(): Observable<MwsNode> {
    const obs$ = {
      showVersion: this.showVersion.execute(),
      showIdentification: this.showIdentification.execute(),
      showMwsMember: this.showMwsMember.execute(),
    };

    return forkJoin(obs$)
      .pipe(
        map((data) => {
          const {showVersion, showIdentification, showMwsMember} = data;
        }),
      );
  }
}
