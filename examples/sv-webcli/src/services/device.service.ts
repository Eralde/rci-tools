import {Observable, forkJoin, map, switchMap} from 'rxjs';
import type {GenericObject} from '@rci-tools/core';
import {RciQuery} from '@rci-tools/core';
import {rciService} from '../api/rci.service.ts';
import {
  DETAIL_LEVEL,
  LogItem,
  RRD_ATTRIBUTE,
  RrdTick,
  ShowInterfaceRrdService,
  ShowInterfaceService,
  ShowInterfaceStatApiService,
  ShowLogService,
  ShowSystemRrdCpuService,
  ShowSystemRrdMemoryService,
  ShowSystemService,
  ShowVersionResponse,
  ShowVersionService,
} from '../api';

export interface SystemLoadMonitorData {
  currentCpuLoad: number;
  cpuLoadHistory: number[];
  currentMemoryLoad: number;
  memoryLoadHistory: number[];
}

export interface WanInterfaceMonitorData {
  address: string;
  currentTxSpeed: number;
  txSpeedHistory: Array<RrdTick>;
  currentRxSpeed: number;
  rxSpeedHistory: Array<RrdTick>;
}

class DeviceService {
  private showInterfaceApi: ShowInterfaceService;
  private showInterfaceRrdApi: ShowInterfaceRrdService;
  private showInterfaceStatApi: ShowInterfaceStatApiService;
  private showLogApi: ShowLogService;
  private showSystemApi: ShowSystemService;
  private showSystemRrdCpuApi: ShowSystemRrdCpuService;
  private showSystemRrdMemoryApi: ShowSystemRrdMemoryService;
  private showVersionApi: ShowVersionService;

  constructor() {
    this.showInterfaceApi = new ShowInterfaceService(rciService);
    this.showInterfaceRrdApi = new ShowInterfaceRrdService(rciService);
    this.showInterfaceStatApi = new ShowInterfaceStatApiService(rciService);
    this.showLogApi = new ShowLogService(rciService);
    this.showSystemApi = new ShowSystemService(rciService);
    this.showSystemRrdCpuApi = new ShowSystemRrdCpuService(rciService);
    this.showSystemRrdMemoryApi = new ShowSystemRrdMemoryService(rciService);
    this.showVersionApi = new ShowVersionService(rciService);
  }

  public getDeviceProfile(): Observable<ShowVersionResponse> {
    return this.showVersionApi.read();
  }

  public getSystemLoadData(maxHistoryPoints: number): Observable<SystemLoadMonitorData> {
    const obs$ = {
      cpuRrd: this.showSystemRrdCpuApi.read({
        detail: DETAIL_LEVEL.THREE_MINUTES,
        count: maxHistoryPoints,
        attribute: 'avg',
      }),
      memoryRrd: this.showSystemRrdMemoryApi.read({
        detail: DETAIL_LEVEL.THREE_MINUTES,
        count: maxHistoryPoints,
        attribute: 'used',
      }),
      showSystem: this.showSystemApi.read(),
    };

    return forkJoin(obs$)
      .pipe(
        map(({cpuRrd, memoryRrd, showSystem}) => {
          const currentCpuLoad = showSystem.cpuload;
          const cpuLoadHistory = cpuRrd.data
            .sort((a, b) => parseFloat(a.t) - parseFloat(b.t))
            .map((tick) => tick.v);

          const memoryTotal = showSystem.memtotal;
          const memoryUsed = Number(showSystem.memory.split('/')[0]);
          const currentMemoryLoad = Math.round(100 * (memoryUsed / memoryTotal));
          const memoryLoadHistory = memoryRrd.data
            .sort((a, b) => parseFloat(a.t) - parseFloat(b.t))
            .map((tick) => Math.round(100 * (tick.v / memoryTotal)));

          return {
            currentCpuLoad,
            cpuLoadHistory,
            currentMemoryLoad,
            memoryLoadHistory,
          };
        }),
      );
  }

  public getLog(): Observable<LogItem[]> {
    return this.showLogApi.read(300)
      .pipe(
        map((response) => (Object.values(response?.log ?? {}) ?? [])),
      );
  }

  public getWanInterfaceData(maxHistoryPoints: number): Observable<WanInterfaceMonitorData> {
    return this.showInterfaceApi.read()
      .pipe(
        switchMap((interfaceStatuses) => {
          let defaultGwInterfaceId: string | null = null;
          let address = '';

          for (const [key, interfaceStatus] of Object.entries(interfaceStatuses)) {
            if (interfaceStatus?.defaultgw === true) {
              defaultGwInterfaceId = interfaceStatus.id ?? key;
              address = interfaceStatus?.address ?? '';

              break;
            }
          }

          if (!defaultGwInterfaceId) {
            throw new Error('No default gateway interface found.');
          }

          const obs$ = {
            interfaceStat: this.showInterfaceStatApi.read({name: defaultGwInterfaceId}),
            txRrdResponse: this.showInterfaceRrdApi.read({
              name: defaultGwInterfaceId,
              detail: DETAIL_LEVEL.THREE_MINUTES,
              attribute: RRD_ATTRIBUTE.TXSPEED,
            }),
            rxRrdResponse: this.showInterfaceRrdApi.read({
              name: defaultGwInterfaceId,
              detail: DETAIL_LEVEL.THREE_MINUTES,
              attribute: RRD_ATTRIBUTE.RXSPEED,
            }),
          };

          return forkJoin(obs$)
            .pipe(
              map((response) => {
                if (!response) {
                  throw new Error('No response or failed to execute RCI queries for interface monitor data.');
                }

                const {txRrdResponse, rxRrdResponse, interfaceStat} = response;

                const txData = txRrdResponse?.data ?? [];
                const rxData = rxRrdResponse?.data ?? [];

                // Sort by time, limit to `maxHistoryPoints`
                const txSpeedHistory: Array<RrdTick> = txData
                  .map((tick) => ({t: parseFloat(tick.t), v: tick.v}))
                  .sort((a, b) => a.t - b.t)
                  .slice(-maxHistoryPoints);

                const rxSpeedHistory: Array<RrdTick> = rxData
                  .map((tick) => ({t: parseFloat(tick.t), v: tick.v}))
                  .sort((a, b) => a.t - b.t)
                  .slice(-maxHistoryPoints);

                // Get current speeds from interface stat
                // The response is Record<string, ShowInterfaceStatResponse>, get the first value
                const statData = interfaceStat;
                const currentTxSpeed = statData?.txspeed ?? 0;
                const currentRxSpeed = statData?.rxspeed ?? 0;

                return {
                  address,
                  currentTxSpeed,
                  currentRxSpeed,
                  txSpeedHistory,
                  rxSpeedHistory,
                };
              }),
            );
        }),
      );
  }

  public getInterfaces(): Observable<Record<string, GenericObject>> {
    const interfacesQuery: RciQuery = {path: 'show.interface'};
    return rciService.queue(interfacesQuery) as Observable<Record<string, GenericObject>>;
  }
}

export const deviceService = new DeviceService();
