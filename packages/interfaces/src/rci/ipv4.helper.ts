export class Ipv4Helper {
  public static maskToCidr(maskStr: string): number {
    return maskStr
      .split('.')
      .map(Number)
      // eslint-disable-next-line no-bitwise
      .map((octet) => (octet >>> 0).toString(2))
      .join('')
      .split('1').length - 1;
  }
}
