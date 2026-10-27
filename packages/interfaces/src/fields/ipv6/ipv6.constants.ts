export const IPV6 = 'ipv6';
export const IPV6_GATEWAY = 'ipv6.gateway';
export const IPV6_NAME_SERVER = 'ipv6.name-server';
export const IPV6_NAME_SERVERS = 'ipv6.name-servers';

export const AUTO_KEYWORD = 'auto';

export const EMPTY_IPV6_WITH_AUTO_LIST = [{[AUTO_KEYWORD]: false}];

// In the updated version of the API related to IPv6 the `{auto: true|false}` element
// is always present in the IPv6 addresses and IPv6 prefixes lists.
//
// The `toScalar` method in the IPv6 fields will replace the `{auto: false}` element with AUTO_MODE_IS_DISABLED,
// and then strip it out from the returned string list, because it seems that the "IPv6 is disabled" state
// should correspond to an empty list of addresses/prefixes.
export const AUTO_MODE_IS_DISABLED = '___AUTO_MODE_IS_DISABLED__';
