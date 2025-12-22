**English** | [Русский](README.ru.md)

# Local Monitor

Local Monitor is a terminal-based example application for monitoring Keenetic/Netcraze devices.
It is built with [Ink](https://github.com/vadimdemedes/ink) and React.
Communication with monitored device is handled via the `rci-manager` and `rci-adapter-axios` packages.

<img src="./local-monitor.svg"/>

Once you provide credentials for a new device, this app will poll the device's status
and display it in a table of all monitored devices.

Device credentials are stored in a SQLite database (a file inside the app folder).

> [!IMPORTANT]
> Local Monitor is a sample application; do not use it for anything serious.
> The device credentials you enter are stored in plain text.

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or newer (Node 22+ recommended)
- [pnpm](https://pnpm.io/)

### Install dependencies

```bash
pnpm install
```

### Development mode

```bash
pnpm dev
```

### Production build

```bash
pnpm build
```

### Start the app (after running the `build` script)

```bash
pnpm start
```

### Other scripts

- `clean` – Remove the `dist/` directory.
- `fmt` – Format source files using dprint.
