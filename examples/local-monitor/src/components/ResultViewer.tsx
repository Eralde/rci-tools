import React, {useEffect, useRef} from 'react';
import {Box, Text, useInput} from 'ink';

export interface ResultViewerProps {
  title: string;
  result: unknown;
  error: string;
  onExitToMenu(): void; // called on ESC
  autoCloseDelayMs: number;
}

export const ResultViewer: React.FC<ResultViewerProps> = (
  {title = 'Result', result, error, onExitToMenu, autoCloseDelayMs = 0},
) => {
  const hasExited = useRef(false);
  const exitSelf = () => {
    hasExited.current = true;

    onExitToMenu();
  };

  useInput((_input, key) => {
    if (key.escape && !hasExited.current) {
      exitSelf();
    }
  });

  useEffect(() => {
    if (autoCloseDelayMs) {
      const timer = setTimeout(
        () => {
          if (!hasExited.current) {
            exitSelf();
          }
        },
        autoCloseDelayMs,
      );

      return () => clearTimeout(timer);
    }

    return; // explicit return void when `autoCloseDelayMs` is undefined
  }, [autoCloseDelayMs]);

  return (
    <Box flexDirection='column' borderStyle='round' paddingX={1} paddingY={1}>
      <Text color={error ? 'red' : 'green'}>{title}</Text>
      <Box marginTop={1}>
        {error ? <Text>{error}</Text> : <Text>{JSON.stringify(result, null, 2)}</Text>}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Press Esc to return to menu.</Text>
      </Box>
    </Box>
  );
};
