import {Subject} from 'rxjs';
import {FitAddon} from '@xterm/addon-fit';
import {Terminal} from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';

export const spawnCli = (): Promise<unknown> => {
  return fetch('/spawn_ttyd');
};

export const killCli = (): Promise<unknown> => {
  return fetch('/kill_ttyd');
};

export interface TerminalInstance {
  terminal: Terminal;
  fitAddon: FitAddon;
  onClose: Subject<CloseEvent>;
  dispose: () => void;
}

// @see https://github.com/tsl0922/ttyd/issues/1400#issuecomment-2394864445
export const connectToCli = (element: HTMLElement): TerminalInstance => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const parts = [
    protocol,
    '//',
    window.location.host,
    '/ws',
  ];

  const wsUrl = parts.join('');
  const socket = new WebSocket(wsUrl, ['tty']);

  socket.binaryType = 'arraybuffer';

  const term = new Terminal();
  const fitAddon = new FitAddon();
  const onClose = new Subject<CloseEvent>();

  term.loadAddon(fitAddon);
  term.open(element);

  let isSocketReady = false;
  let hasReceivedMessage = false;

  // on open -> send initial handshake
  socket.addEventListener(
    'open',
    () => {
      isSocketReady = true;

      const msg = JSON.stringify({
        columns: term.cols,
        rows: term.rows,
      });

      socket.send(new TextEncoder().encode(msg));
    },
  );

  // server side (first byte is message type)
  //
  // OUTPUT = '0',
  // SET_WINDOW_TITLE = '1',
  // SET_PREFERENCES = '2',
  socket.addEventListener(
    'message',
    (event) => {
      // fit terminal after receiving first message from server
      if (!hasReceivedMessage) {
        hasReceivedMessage = true;

        requestAnimationFrame(() => {
          fitAddon.fit();
        });
      }

      const data = new Uint8Array(event.data);
      const cmd = String.fromCharCode(data[0]);
      const payload = data.slice(1);

      switch (cmd) {
        case '0': // OUTPUT
          term.write(payload);
          break;

        case '1': // SET_WINDOW_TITLE
          // ignore
          break;

        case '2': // SET_PREFERENCES
          console.log('SET_PREFERENCES', new TextDecoder().decode(payload));
          break;
      }
    },
  );

  // client side:
  //
  // INPUT = '0'
  // RESIZE_TERMINAL = '1',
  // PAUSE = '2',
  // RESUME = '3',

  // send terminal input to server (INPUT)
  term.onData((data) => {
    if (!isSocketReady) {
      return;
    }

    const enc = new TextEncoder();
    const payload = enc.encode(data);
    const buf = new Uint8Array(payload.length + 1);

    buf[0] = '0'.charCodeAt(0); // INPUT: first byte is '0' (INPUT), then UTF-8 data

    buf.set(payload, 1);
    socket.send(buf);
  });

  // RESIZE_TERMINAL
  term.onResize(({cols, rows}) => {
    if (!isSocketReady) {
      return;
    }

    const msg = JSON.stringify({columns: cols, rows: rows});
    const enc = new TextEncoder();
    const buf = enc.encode('1' + msg);

    socket.send(buf);
  });

  // Handle WebSocket close
  socket.addEventListener('close', (event) => {
    isSocketReady = false;

    onClose.next(event);
  });

  return {
    terminal: term,
    fitAddon,
    onClose,
    dispose: () => {
      socket.close();
      term.dispose();
      onClose.complete();
    },
  };
};
