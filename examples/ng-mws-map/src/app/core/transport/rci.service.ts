import {Injectable} from '@angular/core';
import {ExecuteOptions, GenericResponse$, RciManager, RciTask} from 'rci-manager';
import {NgTransport} from './ng.transport';

@Injectable({
  providedIn: 'root',
})
export class RciService {
  private readonly rciManager: RciManager;

  constructor(
    private ngTransport: NgTransport,
  ) {
    this.rciManager = new RciManager(window.origin, this.ngTransport);
  }

  public execute(query: RciTask, options?: ExecuteOptions): GenericResponse$ {
    return this.rciManager.execute(query, options);
  }
}
