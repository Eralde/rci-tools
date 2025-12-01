import {Injectable} from '@angular/core';
import {RciService} from '@core/transport';
import {BaseActionService} from '../_classes';
import {ShowVersionResponse} from './show-version.response';

@Injectable({
  providedIn: 'root',
})
export class ShowVersionActionService extends BaseActionService<ShowVersionResponse> {
  constructor(
    protected override rciService: RciService,
  ) {
    super(rciService, 'show.version');
  }
}
