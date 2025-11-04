export const SHOW_IDENTIFICATION = 'show.identification';

export interface ShowIdentificationResponse {
  servicetag: string;
  serial: string;
  mac: string;
  hwid: string;
  cid: string;
}
