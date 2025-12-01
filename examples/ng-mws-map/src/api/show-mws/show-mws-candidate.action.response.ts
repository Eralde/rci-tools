import {GenericObject} from 'rci-manager';

export enum MWS_CANDIDATE_STATE {
  INITIAL = 'INITIAL',
  LIST_CONTINUE = 'LIST_CONTINUE',
  UPDATE_CONTINUE = 'UPDATE_CONTINUE',
  UPDATE_REBOOT = 'UPDATE_REBOOT',
  DISCONNECTED = 'DISCONNECTED',
  INCOMPATIBLE = 'INCOMPATIBLE',
  COMPATIBLE = 'COMPATIBLE',
  COMPATIBLE_UPDATE = 'COMPATIBLE_UPDATE',
}

export interface MwsCandidateData {
  mac: string;
  cid: string; // can be an empty string
  mode: string; // can be an empty string
  model: string; // can be an empty string
  state: MWS_CANDIDATE_STATE;
  fw?: string; // can be an empty string
  'fw-available'?: string; // can be an empty string
  'license': string;
  'eula-accepted'?: boolean;
  'dpn-accepted'?: boolean;
  rci: GenericObject;
}

export type ShowMwsCandidateActionResponse = Array<MwsCandidateData>;
