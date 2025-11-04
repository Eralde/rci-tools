import {Subscription, firstValueFrom, interval} from 'rxjs';
import {RciQuery} from 'rci-manager';
import {withTimeout} from '@utils';
import {type DeviceCredentials, RciService} from './rci.service';
import {Device} from './database';
import {
  SHOW_SYSTEM,
  SHOW_SYSTEM_RRD,
  SHOW_VERSION,
  ShowSystemResponse,
  ShowSystemRrdApiReadResponse,
  ShowVersionResponse,
} from '@queries';

export interface DeviceStatus {
  device: Device;
  isOnline: boolean;
  consecutiveFailures: number;
  lastSeen: number | null;
  rciService: RciService;
  firmwareVersion: string | null;
  cpuLoad: number | null;
  cpuLoadRrd: number[] | null;
  memoryLoad: number | null;
  memoryLoadRrd: number[] | null;
}

interface DeviceMonitor {
  subscription: Subscription;
  status: DeviceStatus;
}

const POLL_INTERVAL_MS = 3000;
const MAX_CONSECUTIVE_FAILURES = 3;

export class DeviceMonitorService {
  private monitors = new Map<string, DeviceMonitor>();

  public startMonitoring(device: Device, onStatusUpdate: (status: DeviceStatus) => void): void {
    this.stopMonitoring(device.id);

    const credentials: DeviceCredentials = {
      address: device.address,
      username: device.username,
      password: device.password,
    };

    const rciService = new RciService(credentials);

    const status: DeviceStatus = {
      device,
      isOnline: false,
      consecutiveFailures: 0,
      lastSeen: device.lastSeen,
      rciService,
      firmwareVersion: null,
      cpuLoad: null,
      cpuLoadRrd: null,
      memoryLoad: null,
      memoryLoadRrd: null,
    };

    const adjustStatusOnFailure = (): void => {
      status.consecutiveFailures++;
      status.isOnline = status.consecutiveFailures < MAX_CONSECUTIVE_FAILURES;
      status.cpuLoad = null;
      status.cpuLoadRrd = null;
      status.memoryLoad = null;
      status.memoryLoadRrd = null;
    };

    // Initial poll
    const poll = async (): Promise<void> => {
      try {
        const queries: RciQuery[] = [
          {
            path: SHOW_VERSION,
          },
          {
            path: SHOW_SYSTEM_RRD,
            data: {
              cpu: {
                'detail': 0,
                'attribute': 'avg',
              },
            },
          },
          {
            path: SHOW_SYSTEM_RRD,
            data: {
              memory: {
                'detail': 0,
                'attribute': 'used',
              },
            },
          },
          {
            path: SHOW_SYSTEM,
          },
        ];

        const result = await withTimeout(
          firstValueFrom(rciService.execute(queries)),
          2000,
        ) as [
          ShowVersionResponse,
          ShowSystemRrdApiReadResponse<'cpu'>,
          ShowSystemRrdApiReadResponse<'memory'>,
          ShowSystemResponse,
        ] | null;

        if (result !== null) {
          status.consecutiveFailures = 0;
          status.isOnline = true;
          status.lastSeen = Date.now();
          status.firmwareVersion = result[0].title;
          status.cpuLoad = result[3].cpuload;
          status.cpuLoadRrd = result[1].cpu.data
            .reverse()
            .map((tick) => tick.v);

          const memoryUsed = Number(result[3].memory.split('/')[0]);
          const memoryTotal = Number(result[3].memtotal);

          status.memoryLoad = Math.round(100 * (memoryUsed / memoryTotal));
          status.memoryLoadRrd = result[2].memory.data
            .reverse()
            .map((tick) => Math.round(100 * (tick.v / memoryTotal)));
        } else {
          adjustStatusOnFailure();
        }
      } catch {
        adjustStatusOnFailure();
      }

      onStatusUpdate({...status});
    };

    void poll();

    const subscription = interval(POLL_INTERVAL_MS)
      .subscribe(() => {
        void poll();
      });

    this.monitors.set(device.id, {subscription, status});
  }

  public stopMonitoring(deviceId: string): void {
    const monitor = this.monitors.get(deviceId);

    if (monitor) {
      monitor.subscription.unsubscribe();
      this.monitors.delete(deviceId);
    }
  }

  public stopAll(): void {
    for (const monitor of this.monitors.values()) {
      monitor.subscription.unsubscribe();
    }

    this.monitors.clear();
  }

  public getStatus(deviceId: string): DeviceStatus | undefined {
    return this.monitors.get(deviceId)?.status;
  }
}
