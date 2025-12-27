import {Observable} from 'rxjs';
import type {GenericObject, ObjectOrArray} from '../type.utils';

export interface QueueOptions {
  saveConfiguration?: boolean;
  isPriorityTask?: boolean;
}

export interface BackgroundTaskOptions {
  timeout?: number;
  skipPostQuery?: boolean;
  isInfinite?: boolean; // certain background tasks (e.g., 'show log') may run indefinitely
  onDataUpdate?: (data: GenericObject) => void;
}

export interface RciResponse {
  [key: string]: unknown;
  error?: unknown;
  status?: unknown;
  body?: unknown;
}

export type GenericResponse = Observable<ObjectOrArray>;
