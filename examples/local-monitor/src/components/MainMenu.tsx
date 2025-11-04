import React from 'react';
import {Box, Text} from 'ink';
import SelectInput from 'ink-select-input';
import {useNavigationStore} from '@store/navigation';

export interface MenuItem {
  label: string;
  value: string;
}

const mainMenuItems: MenuItem[] = [
  {label: 'add new device', value: 'add-device'},
  {label: 'show devices', value: 'show-devices'},
  {label: 'quit', value: 'quit'},
];

export const MainMenu: React.FC = () => {
  const {push} = useNavigationStore();

  const onItemSelect = (item: MenuItem): void => {
    if (item.value === 'quit') {
      process.exit(0);
    } else if (item.value === 'add-device') {
      push('AcquireDialog');
    } else if (item.value === 'show-devices') {
      push('DevicesTable');
    }
  };

  return (
    <Box flexDirection='column' borderStyle='round' paddingX={1} paddingY={1}>
      <Text>RCI Device Monitor</Text>
      <Box marginTop={1}>
        <SelectInput
          items={mainMenuItems}
          onSelect={onItemSelect}
        />
      </Box>
    </Box>
  );
};
