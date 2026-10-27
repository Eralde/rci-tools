import {type NO_COMMAND_TYPE} from '../../rci';

export type RciListType<T> =
  | Array<T | T & NO_COMMAND_TYPE>
  | NO_COMMAND_TYPE;
