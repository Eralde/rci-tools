import {Injectable} from '@angular/core';
import {RciService} from '@core/transport';
import {BaseActionService} from '../_classes';
import {ShowMwsCandidateActionResponse} from './show-mws-candidate.action.response';

@Injectable({
  providedIn: 'root',
})
export class ShowMwsCandidateActionService extends BaseActionService<ShowMwsCandidateActionResponse> {
  constructor(
    protected override rciService: RciService,
  ) {
    super(rciService, 'show.mws.candidate', {});
  }
}
