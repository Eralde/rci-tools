import {Observable} from 'rxjs';
import type {ObjectOrArray} from '../type.utils';

export interface QueueOptions {
  saveConfiguration?: boolean;
  isPriorityTask?: boolean;
}

export interface RciResponse {
  [key: string]: unknown;
  error?: unknown;
  status?: unknown;
  body?: unknown;
}

export type GenericResponse = Observable<ObjectOrArray>;
