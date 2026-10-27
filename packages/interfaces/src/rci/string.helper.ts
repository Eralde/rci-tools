import * as _ from 'lodash-es';

const DEFAULT_LANGUAGE = 'en';

export class StringHelper {
  public static getDecimalSeparator(lang: string): string {
    const numberWithDecimalSeparator = 1.1;
    const locale = lang?.length === 2 ? lang : DEFAULT_LANGUAGE;

    const parts = Intl?.NumberFormat(locale)?.formatToParts(numberWithDecimalSeparator);

    if (!parts) {
      return '.';
    }

    return parts?.find((part) => part.type === 'decimal')?.value ?? '.';
  }

  public static stringToNumberArray(
    str: string = '',
    separator: string = ',',
  ): number[] {
    return String(str)
      .split(separator)
      .filter((v) => !isNaN(parseInt(v, 10)))
      .map(Number);
  }

  /**
   * SFP port on KN-2710 is named 'SFP', so stringToNumberArray
   * is not suitable for splitting ports list
   */
  public static stringToPortsArray(
    str: string = '',
    separator: string = ',',
  ): string[] {
    return _
      .chain(str)
      .split(separator)
      .filter()
      .uniq()
      .value();
  }
}
