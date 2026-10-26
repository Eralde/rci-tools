# Try auth

These interactive scripts check NDW2 and NDW4 authentication against a real device:

```bash
pnpm --filter try-auth ndw2
pnpm --filter try-auth ndw4
```

`poll-login` polls login every 5 seconds, for example while a device reboots:

```bash
pnpm --filter try-auth poll-login
```

It sends real login attempts, which can trigger the device's account lockout. A guard limits
attempt frequency. Run from the repository root and stop with Ctrl+C.
