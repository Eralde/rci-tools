# `rci-tools`

Keenetic/Netcraze devices provide a [REST](https://en.wikipedia.org/wiki/REST)-like
JSON API allowing to configure and monitor the device.
The API is called RCI (**R**EST **C**ore **I**nterface).
This repository contains unofficial documentation for this API
and `npm` packages that can be used to interact with this API
from JavaScript/TypeScript code.

There are three distinct parts in this repository:
1. Documentation for the RCI API available on Keenetic/Netcraze devices ([/docs](./docs))
2. `npm` packages that can be used to interact with that API ([/packages](./packages))
3. Example applications created using those `npm` packages ([/examples](./examples))

## 1. Documentation

- [Password-based authentication](./docs/AUTH.md)
- [RCI API](./docs/RCI_API.md)


## 2. `npm` Packages
- [@rci-tools/core](packages/core)
- [@rci-tools/adapter-axios](./packages/adapter-axios)

### Prerequisites

To be able to run code included into this repository you need to install
certain software on your machine.

- Node.js (v22 or a newer LTS version)
- `pnpm` package manager (can be installed by [corepack](https://github.com/nodejs/corepack) distributed with Node.js)

```shell
corepack enable pnpm # install pnpm via corepack
```

## 3. Example apps

### Prerequisites

In order to run the example apps, you need to build the packages first.
Run `pnpm build:packages` in the repository root to build the packages.
Then follow the steps described in the README.md file of the application
you want to run.

### Apps

- [Simple browser demo](./examples/simple-browser-demo)
- [Simple Node.js demo](./examples/simple-nodejs-demo)
- [Local Monitor (Node.js)](./examples/local-monitor)
- [WebCLI (Svelte)](./examples/sv-webcli)

<br/>

> Example apps that are designed to run in a browser require certain "backend"
> configured on the target Keenetic/Netcraze device. To configure the backend
> you will need to [install the Entware repository](https://help.keenetic.com/hc/en-us/articles/360021214160-Installing-the-Entware-repository-package-system-on-a-USB-drive)
> on the target device and be able to connect to that device using SSH.
> Example apps will contain scripts that will configure the backend
> for you using SSH access to the device.
>
> For password-based SSH access those scripts will expect you to have
> the `sshpass` utility in your system. Windows users can try
> [sshpass-win32](https://github.com/xhcoding/sshpass-win32).
>
> For key-based SSH access you should replace `dropbear` installed by
> the Entware installer with OpenSSH server. A guide on how to do that
> can be found [here](https://forum.keenetic.ru/topic/361-openssh-%D0%B2%D0%BC%D0%B5%D1%81%D1%82%D0%BE-dropbear-%D0%BD%D0%B0%D1%81%D1%82%D1%80%D0%BE%D0%B9%D0%BA%D0%B0-%D0%B8-%D0%B8%D1%81%D0%BF%D0%BE%D0%BB%D1%8C%D0%B7%D0%BE%D0%B2%D0%B0%D0%BD%D0%B8%D0%B5/) (in Russian).
