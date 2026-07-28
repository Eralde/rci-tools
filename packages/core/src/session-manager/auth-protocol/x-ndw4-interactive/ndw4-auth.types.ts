/**
 * The reply shapes come straight out of `JSON.parse`, so every field
 * is `unknown` until the phase that consumes it has checked its type.
 */
export interface Ndw4ServerReply {
  error?: unknown;
  e?: unknown;
}

export interface Ndw4FirstReply extends Ndw4ServerReply {
  /** base64 */
  salt?: unknown;
  /** base64, client nonce + server nonce */
  nonce?: unknown;
  /** Argon2id iterations, sent as a number or as a decimal string */
  iter?: unknown;
  /** Argon2id memory cost in KiB, sent as a number or as a decimal string */
  memcost?: unknown;
}

export interface Ndw4SecondReply extends Ndw4ServerReply {
  /** base64 */
  signature?: unknown;
}

/** Everything the handshake needs before its first request is sent. */
export interface Ndw4ClientHandshake {
  authUrl: string;
  username: string;
  password: string;
  clientNonce: string;
}

/**
 * A validated first server reply:
 * Argon2 parameters plus the SCRAM AuthMessage they complete.
 */
export interface Ndw4Challenge extends Ndw4ClientHandshake {
  combinedNonce: string;
  salt: Uint8Array;
  iterations: number;
  memorySize: number;
  authMessage: string;
}

export interface Ndw4Keys {
  clientKey: Uint8Array;
  storedKey: Uint8Array;
  serverKey: Uint8Array;
}

/**
 * A challenge with the keys derived from it:
 * everything the last two phases need to sign with.
 */
export interface Ndw4Secrets extends Ndw4Challenge {
  keys: Ndw4Keys;
}

/** A verified second server reply: the server has proven that it knows the password. */
export interface Ndw4ServerSignature extends Ndw4Secrets {
  signatureBase64: string;
}
