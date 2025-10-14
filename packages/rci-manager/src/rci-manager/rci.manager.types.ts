import {Observable} from 'rxjs';
import type {GenericObject, ObjectOrArray} from '../type.utils';

export type OnDataUpdateFunction = (data: GenericObject) => void;

export interface ExecuteOptions {
  saveConfiguration?: boolean;
  isPriorityTask?: boolean;
}

export interface ExecuteContinuedOptions {
  timeout?: number;
  skipPostQuery?: boolean;
  isInfinite?: boolean; // a common case for log requests
  onDataUpdate?: OnDataUpdateFunction;
}

export interface RciResponse {
  [key: string]: unknown;
  error?: unknown;
  status?: unknown;
  body?: unknown;
}

export type GenericResponse$ = Observable<ObjectOrArray>;
