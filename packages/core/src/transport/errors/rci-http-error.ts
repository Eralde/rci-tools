import type {BaseHttpResponse} from '../http.transport';

export interface RciHttpErrorOptions<ResponseType extends BaseHttpResponse = BaseHttpResponse> {
  status: number | null;
  response?: ResponseType | null;
  cause?: unknown;
}

const RCI_HTTP_ERROR_BRAND = Symbol.for('@rci-tools/core/RciHttpError');

export class RciHttpError<ResponseType extends BaseHttpResponse = BaseHttpResponse> extends Error {
  public readonly status: number | null;
  public readonly response: ResponseType | null;

  constructor(message: string, options: RciHttpErrorOptions<ResponseType>) {
    super(message, {cause: options.cause});

    this.name = 'RciHttpError';
    this.status = options.status;
    this.response = options.response ?? null;

    Object.defineProperty(this, RCI_HTTP_ERROR_BRAND, {value: true});
  }
}

export const isRciHttpError = (error: unknown): error is RciHttpError => {
  return typeof error === 'object'
    && error !== null
    && (error as Record<PropertyKey, unknown>)[RCI_HTTP_ERROR_BRAND] === true;
};
