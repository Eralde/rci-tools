import {Observable, of} from 'rxjs';
import {RciQuery} from '@rci-tools/core';
import {SYSTEM_CONFIGURATION_SAVE, SYSTEM_DESCRIPTION} from '@queries';
import {getAllDevices} from './database';
import {DeviceCredentials, RciService} from './rci.service';

export class DeviceConfiguratorService {
  public setDeviceName(id: string, name: string): Observable<unknown> {
    const device = getAllDevices().find((device) => device.id === id);

    if (!device) {
      console.warn(`Device with id "${id}" not found`);

      return of(null);
    }

    const queries: RciQuery[] = [
      {path: SYSTEM_DESCRIPTION, data: name},
      {path: SYSTEM_CONFIGURATION_SAVE},
    ];

    const credentials: DeviceCredentials = {
      address: device.address,
      username: device.username,
      password: device.password,
    };

    const rciService = new RciService(credentials);

    return rciService.execute(queries);
  }
}
