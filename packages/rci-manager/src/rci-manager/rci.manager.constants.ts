import {ExecuteContinuedOptions, ExecuteOptions} from './rci.manager.types';

export const DEFAULT_EXECUTE_OPTIONS: ExecuteOptions = {
  saveConfiguration: false,
  isPriorityTask: false,
};

export const DEFAULT_EXECUTE_CONTINUED_OPTIONS: ExecuteContinuedOptions = {
  timeout: 1000,
  skipPostQuery: false,
  isInfinite: false,
  onDataUpdate: () => {},
};
