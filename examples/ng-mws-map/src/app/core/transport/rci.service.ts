import {Injectable} from '@angular/core';
import {GenericResponse, QueueOptions, RciManager, RciTask} from '@rci-tools/core';
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

  public queue(query: RciTask, options?: QueueOptions): GenericResponse {
    return this.rciManager.queue(query, options);
  }
}
