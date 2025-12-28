**English** | [Русский](README.ru.md)

# Simple Node.js Demo

This example demonstrates a basic Node.js CLI application that uses
the `@rci-tools/core` and `@rci-tools/adapter-axios` packages
to interact with the RCI API. It shows how to:

- authenticate using username and password
- execute a single RCI query
- execute multiple RCI queries in a single HTTP request
- manage "background processes" (like `tools ping` and `components list`)

## Prerequisites

- Node.js (LTS version >= 22 recommended)
- pnpm package manager
- A Keenetic/Netcraze device accessible on your network

## Setup

1. **Navigate to the project directory:**
   ```bash
   cd examples/simple-nodejs-demo
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

## Running the Application

Run the demo:

```bash
pnpm dev
```

The application will prompt you for:
- Device IPv4 address (default: `192.168.1.1`)
- Username (default: `admin`)
- Password

After authentication, it will execute example queries demonstrating both
regular RCI requests and background processes.

