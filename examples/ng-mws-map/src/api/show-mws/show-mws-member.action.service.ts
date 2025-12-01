import {Injectable} from '@angular/core';
import {RciService} from '@core/transport';
import {BaseActionService} from '../_classes';
import {ShowMwsMemberActionResponse} from './show-mws-member.action.response';

@Injectable({
  providedIn: 'root',
})
export class ShowMwsMemberActionService extends BaseActionService<ShowMwsMemberActionResponse> {
  constructor(
    protected override rciService: RciService,
  ) {
    super(rciService, 'show.mws.member');
  }
}
