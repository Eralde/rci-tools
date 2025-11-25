import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {ExecuteOptions, GenericResponse$, RciManager, RciTask, SessionManager} from 'rci-manager';
import {NgTransport} from './ng.transport';

@Injectable({
  providedIn: 'root',
})
export class RciService {
  private readonly rciManager: RciManager;
  private readonly sessionManager: SessionManager;

  constructor(
    private ngTransport: NgTransport,
  ) {
    this.rciManager = new RciManager(window.origin, this.ngTransport);
    this.sessionManager = new SessionManager(window.origin, this.ngTransport);
  }

  public execute(query: RciTask, options?: ExecuteOptions): GenericResponse$ {
    return this.rciManager.execute(query, options);
  }
}
