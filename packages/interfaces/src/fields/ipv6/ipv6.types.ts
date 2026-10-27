import {type Values} from '../../rci';

export const IPV6_MODE = {
  AUTOMATIC: 'AUTOMATIC',
  MANUAL: 'MANUAL',
  DISABLED: 'DISABLED',
} as const;

export type Ipv6Mode = Values<typeof IPV6_MODE>;
