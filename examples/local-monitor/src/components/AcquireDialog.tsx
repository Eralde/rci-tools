import React, {useState} from 'react';
import {Box, Text, useInput} from 'ink';
import TextInput from 'ink-text-input';
import {catchError, firstValueFrom, of, timeout} from 'rxjs';
import {SHOW_IDENTIFICATION, SHOW_VERSION, ShowIdentificationResponse, ShowVersionResponse} from '@queries';
import {useNavigationStore} from '@store/navigation';
import {type Device, RciService, addDevice} from '@services';
import {RciQuery} from '@rci-tools/base';

const ACQUIRE_FORM_DEFAULTS: AcquireFormState = {
  address: (process.env['RCI_DEVICE_HOST'] || '192.168.1.1').replace(/^http:\/\//, ''),
  username: process.env['RCI_DEVICE_USERNAME'] || 'admin',
  password: process.env['RCI_DEVICE_PASSWORD'] || '',
};

export interface AcquireFormState {
  address: string;
  username: string;
  password: string;
}

interface AcquireDialogProps {
  onExitToMenu(): void;
  onDeviceAdded(device: Device): void;
}

export const AcquireDialog: React.FC<AcquireDialogProps> = (
  {onExitToMenu, onDeviceAdded},
) => {
  const [form, setForm] = useState<AcquireFormState>(ACQUIRE_FORM_DEFAULTS);
  const [focusIndex, setFocusIndex] = useState<number>(0); // 0=addr,1=user,2=pass,3=connect

  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  const [success] = useState(false);

  const {replace, pop} = useNavigationStore();

  useInput((_input, key) => {
    if (key.escape) {
      onExitToMenu();
    }
    if (key.tab) {
      setFocusIndex((focusIndex + 1) % 4);
    }
    if (key.shift && key.tab) {
      setFocusIndex((focusIndex + 3) % 4);
    }
    if (key.return && focusIndex === 3) {
      void handleConnect();
    }
  });

  async function handleConnect() {
    setLocalError('');
    setLoading(true);

    const credentials = {
      address: form.address,
      username: form.username,
      password: form.password,
    };

    const rciService = new RciService(credentials);

    try {
      const queries: RciQuery[] = [
        {path: SHOW_VERSION},
        {path: SHOW_IDENTIFICATION},
      ];

      const obs$ = rciService.execute(queries)
        .pipe(
          timeout(3000),
          catchError(() => of(null)),
        );

      await firstValueFrom(obs$)
        .then((response) => {
          if (response === null) {
            throw new Error('No response');
          }

          const [version, identification] = response as [ShowVersionResponse, ShowIdentificationResponse];
          const addedDevice = addDevice(
            identification.cid,
            form.address,
            form.username,
            form.password,
            version.description,
            version.model,
          );

          onDeviceAdded(addedDevice); // notify parent component

          setLoading(false);
          setForm(ACQUIRE_FORM_DEFAULTS);
          setFocusIndex(0);

          // show success dialog, then return to main menu
          replace(
            'ResultViewer',
            {
              title: 'Success',
              result: 'Device added successfully!',
              error: '',
              onExitToMenu: () => {
                pop();
              },
              autoCloseDelayMs: 3000,
            },
          );
        });
    } catch {
      setLoading(false);
      setLocalError('Failed to connect or authenticate (timeout or error).');
      setFocusIndex(0);
    }
  }

  return (
    <Box flexDirection='column' borderStyle='round' paddingX={1} paddingY={1}>
      <Text>Add new device</Text>
      <Box marginTop={1}>
        <Box width={16}>
          <Text>IP address:</Text>
        </Box>
        <TextInput
          value={form.address}
          onChange={(v) => setForm({...form, address: v})}
          focus={focusIndex === 0}
        />
      </Box>
      <Box marginTop={1}>
        <Box width={16}>
          <Text>Username:</Text>
        </Box>
        <TextInput
          value={form.username}
          onChange={(v) => setForm({...form, username: v})}
          focus={focusIndex === 1}
        />
      </Box>
      <Box marginTop={1}>
        <Box width={16}>
          <Text>Password:</Text>
        </Box>
        <TextInput
          value={form.password}
          onChange={(v) => setForm({...form, password: v})}
          mask='*'
          focus={focusIndex === 2}
        />
      </Box>
      <Box marginTop={1}>
        <Box width={16}>
          <Text>{' '}</Text>
        </Box>
        {focusIndex === 3 ? <Text color='cyan'>[ Add Device ]</Text> : <Text>[ Add Device ]</Text>}
      </Box>
      {loading && (
        <Box marginTop={1}>
          <Text color='yellow'>Checking credentials…</Text>
        </Box>
      )}
      {localError && (
        <Box marginTop={1}>
          <Text color='red'>{localError}</Text>
        </Box>
      )}
      {success && (
        <Box marginTop={1}>
          <Text color='green'>Device authenticated!</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text dimColor>Tip: Use Tab/Shift+Tab to move, Enter to add device.</Text>
      </Box>
    </Box>
  );
};
