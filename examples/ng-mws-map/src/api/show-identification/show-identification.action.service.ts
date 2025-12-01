import {Injectable} from '@angular/core';
import {RciService} from '@core/transport';
import {BaseActionService} from '../_classes';
import {ShowIdentificationActionResponse} from './show-identification.action.response';

@Injectable({
  providedIn: 'root',
})
export class ShowIdentificationActionService extends BaseActionService<ShowIdentificationActionResponse> {
  constructor(
    protected override rciService: RciService,
  ) {
    super(rciService, 'show.identification');
  }
}
