import type {AuthProtocolName, LoginResult} from './auth-protocol/auth-protocol.types';

/**
 * `LoginResult` plus the auth protocol selected from the device challenge (the `GET /auth` reply).
 * Once selected, the protocol is reported whatever happens next, even if it sends no credentials
 * (e.g. NDW2 challenge headers are missing).
 * `protocol` is `null` when no protocol was selected: the session was already there (`200`),
 * or the reply had no usable challenge (network error, unexpected status, none of the allowed protocols offered).
 */
export type LoginDetails = LoginResult & {protocol: AuthProtocolName | null};

export interface SessionManagerOptions {
  // allowed auth protocols, most preferred first: the first one the device offers is used
  protocols?: readonly AuthProtocolName[];
}
