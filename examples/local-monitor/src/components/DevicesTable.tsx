import React, {useState} from 'react';
import {Box, Text, useInput, useStdout} from 'ink';
import {Sparkline} from '@pppp606/ink-chart';
import type {DeviceStatus} from '@services';

interface DevicesTableProps {
  devices: DeviceStatus[];

  onExitToMenu?(): void;

  onDeleteDevice?(deviceId: string): void;

  onEditDeviceName?(deviceId: string, currentName: string): void;
}

export const DevicesTable: React.FC<DevicesTableProps> = (
  {devices, onExitToMenu, onDeleteDevice, onEditDeviceName},
) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [expandedDeviceIds, setExpandedDeviceIds] = useState<Set<string>>(new Set());

  const {stdout} = useStdout();
  const terminalWidth = stdout?.columns || 100;
  const isNarrow = terminalWidth < 100;

  useInput((_input, key) => {
    if (key.escape && onExitToMenu) {
      onExitToMenu();
    }

    if (devices.length > 0) {
      if (key.upArrow) {
        setSelectedIndex(i => (i - 1 + devices.length) % devices.length);
      }

      if (key.downArrow) {
        setSelectedIndex(i => (i + 1) % devices.length);
      }

      if (key.delete && onDeleteDevice && devices[selectedIndex]) {
        onDeleteDevice(devices[selectedIndex].device.id);
      }

      if (_input.toUpperCase() === 'R' && onEditDeviceName && devices[selectedIndex]) {
        onEditDeviceName(devices[selectedIndex].device.id, devices[selectedIndex].device.name);
      }

      if (_input === ' ' && devices[selectedIndex]) {
        const deviceId = devices[selectedIndex].device.id;

        setExpandedDeviceIds(prev => {
          const next = new Set(prev);

          if (next.has(deviceId)) {
            next.delete(deviceId);
          } else {
            next.add(deviceId);
          }

          return next;
        });
      }
    }
  });

  const formatDate = (timestamp: number | null): string => {
    if (timestamp === null) {
      return 'Never';
    }

    return new Date(timestamp).toLocaleString();
  };

  return (
    <Box flexDirection='column' borderStyle='round' paddingX={1} paddingY={1}>
      <Text>Devices</Text>
      <Box marginTop={1} flexDirection='column'>
        <Box paddingX={2}>
          <Box width={36}>
            <Text bold>Name</Text>
          </Box>
          {!isNarrow && (
            <Box width={24}>
              <Text bold>Model</Text>
            </Box>
          )}
          <Box width={18}>
            <Text bold>IP Address</Text>
          </Box>
          <Box width={12}>
            <Text bold>Status</Text>
          </Box>
          {!isNarrow && (
            <Box width={25}>
              <Text bold>Last Seen</Text>
            </Box>
          )}
        </Box>
        {devices.length === 0
          ? (
            <Box marginTop={1}>
              <Text dimColor>No devices found. Add a device to get started.</Text>
            </Box>
          )
          : (
            devices.map((status, idx) => {
              const isSelected = selectedIndex === idx;
              const isExpanded = expandedDeviceIds.has(status.device.id);

              return (
                <Box
                  key={status.device.id}
                  flexDirection='column'
                  borderStyle='single'
                  borderColor={isSelected ? 'cyan' : 'gray'}
                  paddingX={1}
                >
                  <Box>
                    <Box width={36}>
                      <Text>{status.device.name}</Text>
                    </Box>
                    {!isNarrow && (
                      <Box width={24}>
                        <Text>{status.device.model}</Text>
                      </Box>
                    )}
                    <Box width={18}>
                      <Text>{status.device.address}</Text>
                    </Box>
                    <Box width={12}>
                      <Text color={status.isOnline ? 'green' : 'red'}>
                        {status.isOnline ? 'online' : 'offline'}
                      </Text>
                    </Box>
                    {!isNarrow && (
                      <Box width={25}>
                        <Text>{formatDate(status.lastSeen)}</Text>
                      </Box>
                    )}
                  </Box>

                  {isExpanded && (
                    <Box paddingLeft={1} marginTop={1} flexDirection='column' gap={1}>
                      {status.cpuLoadRrd && (
                        <Box width={isNarrow ? 60 : 100}>
                          <Box width={isNarrow ? 15 : 25}>
                            <Text dimColor>CPU:</Text>
                          </Box>
                          <Sparkline
                            data={status.cpuLoadRrd}
                            width={isNarrow ? 35 : 60}
                            threshold={[10, 20, 30, 40, 50, 60, 70, 80]}
                            colorScheme='red'
                          />
                          <Box width={5} marginLeft={1}>
                            <Text dimColor>{status.cpuLoad}%</Text>
                          </Box>
                        </Box>
                      )}

                      {status.memoryLoadRrd && (
                        <Box width={isNarrow ? 60 : 100}>
                          <Box width={isNarrow ? 15 : 25}>
                            <Text dimColor>Memory:</Text>
                          </Box>
                          <Sparkline
                            data={status.memoryLoadRrd}
                            width={isNarrow ? 35 : 60}
                            threshold={[10, 20, 30, 40, 50, 60, 70, 80]}
                            colorScheme='red'
                          />
                          <Box width={5} marginLeft={1}>
                            <Text dimColor>{status.memoryLoad}%</Text>
                          </Box>
                        </Box>
                      )}

                      {!isNarrow && (
                        <Box>
                          <Box width={25}>
                            <Text dimColor>Firmware version:</Text>
                          </Box>
                          <Box>
                            <Text>{status.firmwareVersion || 'Loading...'}</Text>
                          </Box>
                        </Box>
                      )}
                    </Box>
                  )}
                </Box>
              );
            })
          )}
      </Box>
      {devices.length > 0 && ( // dprint-ignore
        <Box marginTop={1}>
          <Text dimColor>
            Use ↑/↓ to select,
            [Space] to expand/collapse,
            [R] to edit name,
            [Del] to remove device,
            [Esc] to return to main menu.
          </Text>
        </Box>
      )}
      {devices.length === 0 && onExitToMenu && (
        <Box marginTop={1}>
          <Text dimColor>Press Esc to return to main menu.</Text>
        </Box>
      )}
    </Box>
  );
};
