# `rci-tools`

This repository consists of three parts:
1. Documentation of the HTTP API available on Keenetic/Netcraze devices
2. TypeScript packages that can be used to interact with that API
3. Example apps build using those packages

## 1. API Documentation

- [Password-based authentication](./docs/AUTH.md)
- [RCI API](./docs/RCI_API.md)


## 2. Packages:
- [@rci-tools/base](./packages/base)
- [@rci-tools/adapter-axios](./packages/adapter-axios)

### Prerequisites

To be able to run code included into this repository you need to install
certain software on your machine.

- Node.js (v22 or a newer LTS version)
- `pnpm` package manager (can be installed by [corepack](https://github.com/nodejs/corepack) distributed with Node.js)

## 3. Example apps

> [!IMPORTANT]
> In order to run the example apps, you need to build the packages first.
> Run `pnpm build:packages` in the repository root to build the packages.
> Proceed with steps described in the README.md of the app you want to run.

- [Simple browser demo](./examples/simple-browser-demo)
- [Simple Node.js demo](./examples/simple-nodejs-demo)
- [Local Monitor (Node.js)](./examples/local-monitor)
- [WebCLI (Svelte)](./examples/sv-webcli)

<br/>

> Example apps that are designed to run in a browser require certain "backend"
> configured on the target Keenetic/Netcraze device. To configure the backend
> you will need to install the Entware repository on the target device and
> be able to connect to that device using SSH. Example apps will contain
> scripts that configure the backend for you given the SSH access.
>
> For password-based SSH access those scripts will expect you to have
> the `sshpass` utility in your system. Windows users can try
> [sshpass-win32](https://github.com/xhcoding/sshpass-win32).