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
    private httpClient: HttpClient,
  ) {
    const transport = new NgTransport(this.httpClient);

    this.rciManager = new RciManager(window.origin, transport);
    this.sessionManager = new SessionManager(window.origin, transport);
  }

  public execute(query: RciTask, options?: ExecuteOptions): GenericResponse$ {
    return this.rciManager.execute(query, options);
  }
}
