import React, {useEffect, useState} from 'react';
import {Box, render} from 'ink';
import {existsSync, mkdirSync} from 'fs';
import {
  AcquireDialog,
  ConfirmDeleteDialog,
  DevicesTable,
  EditDeviceNameDialog,
  MainMenu,
  ResultViewer,
} from '@components';
import {
  type Device,
  DeviceConfiguratorService,
  DeviceMonitorService,
  type DeviceStatus,
  deleteDevice,
  getAllDevices,
  updateDeviceName,
  updateLastSeen,
} from '@services';
import {appDataDir} from '@utils/paths';
import {useNavigationStore} from '@store/navigation';

const App: React.FC = () => {
  const [devices, setDevices] = useState<DeviceStatus[]>([]);
  const [monitorService] = useState(() => new DeviceMonitorService());
  const [configuratorService] = useState(() => new DeviceConfiguratorService());

  const {stack, push, pop} = useNavigationStore();
  const currentScreen = stack[stack.length - 1];

  if (!currentScreen) {
    // should never happen
    return null;
  }

  // ensure app data directory exists
  useEffect(() => {
    const dir = appDataDir();

    if (!existsSync(dir)) {
      mkdirSync(dir, {recursive: true});
    }
  }, []);

  // load devices from DB and start monitoring
  useEffect(() => {
    const loadAndMonitorDevices = (): void => {
      const dbDevices = getAllDevices();
      const statuses: DeviceStatus[] = [];

      for (const device of dbDevices) {
        monitorService.startMonitoring(device, (status) => {
          setDevices((prev) => {
            const updated = [...prev];
            const index = updated.findIndex((s) => s.device.id === device.id);
            if (index >= 0) {
              updated[index] = status;
              if (status.lastSeen) {
                updateLastSeen(device.id, status.lastSeen);
              }
            } else {
              // This branch be unreachable if initial load is correct,
              // or if `onDeviceAdded` correctly triggers a full re-load for the new device.
              updated.push(status);
            }
            return updated;
          });
        });

        const currentStatus = monitorService.getStatus(device.id);
        if (currentStatus) {
          statuses.push(currentStatus);
        }
      }

      setDevices(statuses);
    };

    loadAndMonitorDevices();

    return () => {
      monitorService.stopAll();
    };
  }, [monitorService]);

  const closeSelf = () => {
    pop();
  };

  const handleDeviceAdded = (addedDevice: Device): void => {
    monitorService.startMonitoring(addedDevice, (status) => {
      setDevices((prev) => {
        const updated = [...prev];
        const index = updated.findIndex((s) => s.device.id === addedDevice.id);

        if (index >= 0) {
          updated[index] = status;

          if (status.lastSeen) {
            updateLastSeen(addedDevice.id, status.lastSeen);
          }
        } else {
          // Ensures the newly added device's status is pushed
          // into the devices state if it wasn't already there from getStatus.
          updated.push(status);
        }
        return updated;
      });
    });

    const currentStatus = monitorService.getStatus(addedDevice.id);

    if (currentStatus) {
      setDevices((prev) => [...prev, currentStatus]);
    }
  };

  const confirmDeviceDeletion = (deviceId: string) => {
    const dev = devices.find(d => d.device.id === deviceId);

    if (dev) {
      push('ConfirmDeleteDialog', {device: dev.device});
    }
  };

  const handleDeviceDeletionConfirmed = (deviceId: string): void => {
    monitorService.stopMonitoring(deviceId);
    deleteDevice(deviceId);
    setDevices(devices => devices.filter(d => d.device.id !== deviceId));
    pop();
  };

  const handleDeviceNameChange = (newName: string, deviceId: string) => {
    updateDeviceName(deviceId, newName);

    // get the updated device from the DB
    const updatedDevice = getAllDevices().find(d => d.id === deviceId);

    if (updatedDevice) {
      monitorService.stopMonitoring(deviceId);
      monitorService.startMonitoring(updatedDevice, (status) => {
        setDevices((prev) => {
          const updated = [...prev];
          const index = updated.findIndex((s) => s.device.id === updatedDevice.id);
          if (index >= 0) {
            updated[index] = status;
            if (status.lastSeen) {
              updateLastSeen(updatedDevice.id, status.lastSeen);
            }
          }
          return updated;
        });
      });
    }

    setDevices((devices) => {
      return devices.map(dev =>
        dev.device.id === deviceId && updatedDevice
          ? {...dev, device: updatedDevice}
          : dev
      );
    });

    configuratorService.setDeviceName(deviceId, newName)
      .subscribe();

    pop();
  };

  return (
    <Box flexDirection='column' paddingX={1} paddingY={1}>
      {currentScreen.name === 'MainMenu' && <MainMenu />}

      {currentScreen.name === 'AcquireDialog' && (
        <AcquireDialog
          onDeviceAdded={handleDeviceAdded}
          onExitToMenu={closeSelf}
        />
      )}

      {currentScreen.name === 'DevicesTable' && (
        <DevicesTable
          devices={devices}
          onExitToMenu={closeSelf}
          onDeleteDevice={confirmDeviceDeletion}
          onEditDeviceName={(deviceId, currentName) => {
            push('EditDeviceNameDialog', {deviceId, initialName: currentName});
          }}
        />
      )}

      {currentScreen.name === 'ConfirmDeleteDialog' && currentScreen.props && (
        <ConfirmDeleteDialog
          device={currentScreen.props.device}
          onConfirm={handleDeviceDeletionConfirmed}
          onCancel={closeSelf}
        />
      )}

      {currentScreen.name === 'EditDeviceNameDialog' && currentScreen.props && (
        <EditDeviceNameDialog
          initialName={currentScreen.props.initialName}
          deviceId={currentScreen.props.deviceId}
          onSave={handleDeviceNameChange}
          onCancel={closeSelf}
        />
      )}

      {currentScreen.name === 'ResultViewer' && currentScreen.props && (
        <ResultViewer
          title={currentScreen.props.title}
          result={currentScreen.props.result}
          error={currentScreen.props.error}
          onExitToMenu={currentScreen.props.onExitToMenu}
          autoCloseDelayMs={currentScreen.props.autoCloseDelayMs}
        />
      )}
    </Box>
  );
};

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err?.message ?? String(err));
});

render(<App />);
