[English](README.md) | [Русский](README_RU.md)

# Simple Browser Demo

This example demonstrates a basic web application that uses the `rci-manager` package
to interact with the RCI API. It is written in "vanilla" TypeScript and demonstrates how to:
- authenticate using username and password
- fetch data (`show version`) via the RCI API

## Prerequisites

Before running this example, ensure you have the following:

* `Node.js` (LTS version >= 22 recommended) and `npm` installed.
* `pnpm` installed.
* A Keenetic/Netcraze device, to which your computer is connected as a LAN client.
* SSH access to the Entware on that device if you plan to `deploy` this web app to the device.

## Setup

1.  **Navigate to the project directory:**
    ```bash
    cd examples/simple-browser-demo
    ```

2.  **Install dependencies:**
    ```bash
    pnpm install
    ```

3.  **Configure environment variables:**
    Copy the `.env.template` file to `.env` and update the `PROXY_ADDR` variable with the URL of your RCI device.

    ```bash
    cp .env.template .env
    # Open .env and set PROXY_ADDR, e.g., PROXY_ADDR=http://192.168.1.1
    ```
    This `PROXY_ADDR` will be used by Vite's development server to proxy RCI requests to your device.


## Running the Application

### Development Mode

To run the application in development mode with hot-reloading:

```bash
pnpm run dev
```

Open your browser to the address displayed in the console (e.g., `http://localhost:5174`).
Use your device's username/password to authorise this web app to access RCI API on your device.


### Building for Production

To create a production-ready build:

```bash
npm run build
```

This will generate a single `index.html` file in the `dist` directory, containing all HTML, CSS, and minified JavaScript.


### Deploying the Application

The `deploy` script uses `yargs` to facilitate deploying the production build to a remote server via SCP.

```bash
pnpm run deploy --host <user@remote_host> --path <remote_path> [--port <ssh_port>]
```

**Arguments:**

* `--host <user@remote_host>`: **(Required)** The remote host and username for SSH/SCP (e.g., `user@192.168.1.100`).
* `--path <remote_path>`: **(Required)** The destination path on the remote host where the `dist` files will be copied (e.g., `/var/www/html/demo`).
* `--port <ssh_port>`: **(Optional)** The SSH port to use. Defaults to `22`.

**Example:**

```bash
pnpm run deploy --host entware-host --path /opt/share/nginx/html/browser-demo/ --port 2222
```
