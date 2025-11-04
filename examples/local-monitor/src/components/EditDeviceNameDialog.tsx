import React, {useState} from 'react';
import {Box, Text, useInput} from 'ink';
import TextInput from 'ink-text-input';

interface EditDeviceNameDialogProps {
  initialName: string;
  deviceId: string;
  onSave(newName: string, deviceId: string): void;
  onCancel(): void;
}

export const EditDeviceNameDialog: React.FC<EditDeviceNameDialogProps> = (
  {initialName, deviceId, onSave, onCancel},
) => {
  const [name, setName] = useState(initialName);
  const [focusIndex, setFocusIndex] = useState(0); // 0=input, 1=Save, 2=Cancel

  useInput((_input, key) => {
    if (key.tab) {
      setFocusIndex((focusIndex + 1) % 3);
    }

    if (key.shift && key.tab) {
      setFocusIndex((focusIndex + 2) % 3);
    }

    if (key.escape) {
      onCancel();
    }

    if (key.return) {
      if (focusIndex === 1) {
        onSave(name, deviceId);
      }

      if (focusIndex === 2) {
        onCancel();
      }
    }
  });

  return (
    <Box
      flexDirection='column'
      borderStyle='round'
      borderColor='cyan'
      paddingX={1}
      paddingY={1}
    >
      <Text>Edit Device Name</Text>
      <Box marginTop={1}>
        <TextInput
          value={name}
          onChange={setName}
          focus={focusIndex === 0}
        />
      </Box>
      <Box marginTop={1}>
        <Text>
          {focusIndex === 1 ? <Text color='cyan'>[ Save ]</Text> : <Text>[ Save ]</Text>}{'  '}
          {focusIndex === 2 ? <Text color='cyan'>[ Cancel ]</Text> : <Text>[ Cancel ]</Text>}
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Tab/Shift+Tab to move, Enter to select, Esc to cancel.</Text>
      </Box>
    </Box>
  );
};
