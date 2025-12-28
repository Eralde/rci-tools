**English** | [Русский](README.ru.md)

# sv-webcli

This is an example project that can be used as a `/webcli` alternative.
It provides an option to interact with the RCI API directly or to run
a full CLI session inside your browser. Another useful feature is an option
to view the device log in a separate panel while interacting with the device.

This project is built with [Svelte 5](https://svelte.dev/) and [dockview](https://dockview.dev/).

https://github.com/user-attachments/assets/dfe21a22-4079-4782-b104-39dd297f257d

- **Web-based Terminal**: Full-featured terminal emulator powered by [ttyd](https://github.com/tsl0922/ttyd)
  and [xterm.js](https://xtermjs.org/).
- **REST API** tab that allows to send GET/POST/DELETE HTTP requests to the `/rci/` endpoints (+ request history)
- **Log Viewer**: Side panel for monitoring device log with filtering capabilities

## Prerequisites

- Node.js (v22 or higher)
- pnpm package manager
- SSH access to the target device
- For password-based SSH: `sshpass` utility installed

## Installation

```bash
# From the project root
pnpm install
```

## Running the Application

### Development Mode

Start the development server

```bash
pnpm dev --device-addr <IP_ADDRESS>
```

The dev server runs on `http://localhost:5174` and proxies `/rci/` and `/auth` requests to the device.

**Options:**
- `--device-addr <IP>` - **Required**: Device IP address
- `--http-port <PORT>` - HTTP port for backend service (default: 8081)

**Example:**
```bash
pnpm dev --device-addr 192.168.1.1 --http-port 8081
```

### Production Build

Build the application for production:

```bash
pnpm build
```

The output will be in the `dist` directory.

## Deployment

### Backend Configuration

Configure the device backend (installs required packages, sets up lighttpd, ttyd):

```bash
pnpm configure-backend --device-addr <IP_ADDRESS>
```

This script:
1. Installs required opkg packages (lighttpd, ttyd, ...; see `scripts/conf.ts` for the full list)
2. Creates necessary directories on the device
3. Configures lighttpd with proxy settings
4. Deploys ttyd control scripts
5. Restarts lighttpd service

**Options:**
- `--ssh-host <IP>` - SSH host IP (defaults to device-addr)
- `--ssh-port <PORT>` - SSH port (default: 222)
- `--ssh-key <PATH>` - Path to SSH private key (for key-based auth)
- `--http-port <PORT>` - HTTP port for backend service (default: 8081)
- `--remote-www-root <PATH>` - Remote directory for frontend files (default: `/opt/share/www/`)
- `--ttyd-port <PORT>` - Port for ttyd WebSocket server (default: 7681)
- `--ttyd-scripts-dir <PATH>` - Remote directory for ttyd control scripts (default: `/opt/etc/ttyd/`)

**Example:**
```bash
pnpm configure-backend --device-addr 192.168.1.1 --port 7070 --ssh-key ~/.ssh/id_rsa
```

### Frontend Deployment

Deploy the built frontend to the device:

```bash
pnpm deploy-frontend --device-addr <IP_ADDRESS>
```

This script:
1. Builds the project
2. Creates the remote directory if needed
3. Copies all files from `dist/` to the device via SCP

**Options:** Same as for the `configure-backend` script

**Example:**
```bash
pnpm deploy-frontend --device-addr 192.168.1.1 --remote-www-root /opt/share/www/
```

## Configuration

### Environment Variables

You can set configuration values using a `.env` file in the project root (see `.env.template` for variable names)
or via command-line arguments. The configuration tool helps manage these values:

**List current configuration:**
```bash
pnpm cfg list
```

**Set configuration values:**
```bash
pnpm cfg set --device-addr 192.168.1.1 --ssh-port 222 --http-port 8081
```

**Delete configuration values:**
```bash
pnpm cfg delete --device-addr
```

### Available Configuration Options

| Option               | Environment Variable | Default           | Description                               |
|----------------------|----------------------|-------------------|-------------------------------------------|
| `--device-addr`      | `DEVICE_ADDR`        | -                 | Device IP address (required)              |
| `--ssh-host`         | `SSH_HOST`           | device-addr       | SSH host IP address                       |
| `--ssh-port`         | `SSH_PORT`           | 222               | SSH port                                  |
| `--ssh-key`          | `SSH_KEY`            | -                 | Path to SSH private key                   |
| `--http-port`        | `HTTP_PORT`          | 8081              | HTTP port for backend service             |
| `--remote-www-root`  | `REMOTE_WWW_ROOT`    | `/opt/share/www/` | Remote directory for frontend files       |
| `--ttyd-port`        | `TTYD_PORT`          | 7681              | Port for ttyd WebSocket server            |
| `--ttyd-scripts-dir` | `TTYD_SCRIPTS_DIR`   | `/opt/etc/ttyd/`  | Remote directory for ttyd control scripts |

### SSH Authentication

The application supports two authentication methods:

1. **SSH Key Authentication** (you will need to install and configure OpenSSH in opkg):
   ```bash
   pnpm dev --device-addr 192.168.1.1 --ssh-key ~/.ssh/id_rsa
   ```

2. **Password Authentication**:
   - Requires `sshpass` to be installed
   - You will be prompted for the password when running deployment scripts

## Project Structure

```
sv-webcli/
├── src/
│   ├── api/              # "per command" RCI API services
│   ├── components/       # Svelte components
│   ├── routes/           # Application routes
│   ├── services/         # Business logic services
│   ├── state/            # Application state management
│   └── utils/            # Utility functions
│
├── scripts/
│   ├── configure-backend.ts  # Backend deployment script
│   ├── deploy-frontend.ts    # Frontend deployment script
│   ├── dev.ts                # Development server
│   ├── preview.ts            # Preview server
│   └── opkg/                 # Device configuration files
│
└── dist/                 # Production build output
```

## Available Scripts

| Script                   | Description                              |
|--------------------------|------------------------------------------|
| `pnpm dev`               | Start development server with hot reload |
| `pnpm build`             | Build for production                     |
| `pnpm preview`           | Preview production build                 |
| `pnpm check`             | Run Svelte type checking                 |
| `pnpm fmt`               | Format code with dprint                  |
| `pnpm configure-backend` | Configure device backend                 |
| `pnpm deploy-frontend`   | Deploy frontend to device                |
| `pnpm cfg`               | Manage configuration values              |
