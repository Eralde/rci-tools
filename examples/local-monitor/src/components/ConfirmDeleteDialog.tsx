import React from 'react';
import {Box, Text, useInput} from 'ink';
import type {Device} from '@services';

export const ConfirmDeleteDialog: React.FC<{
  device: Device;
  onConfirm(deviceId: string): void;
  onCancel(): void;
}> = ({device, onConfirm, onCancel}) => {
  useInput((input, key) => {
    if (input.toLowerCase() === 'y') {
      onConfirm(device.id);
    }
    if (input.toLowerCase() === 'n' || key.escape) {
      onCancel();
    }
  });
  return (
    <Box flexDirection='column' borderStyle='round' paddingX={1} paddingY={1}>
      <Text color='red'>Delete device {device.address}?</Text>
      <Box marginTop={1}>
        <Text>Are you sure? (y/n)</Text>
      </Box>
    </Box>
  );
};
