export const SHOW_VERSION = 'show.version';

export interface ShowVersionResponse {
  release: string;
  sandbox: string;
  title: string;
  arch: string;
  ndm: {exact: string; cdate: string};
  bsp: {exact: string; cdate: string};
  ndw: {
    features: string;
    components: string;
  };
  ndw3: {version: string};
  ndw4: {version: string};
  manufacturer: string;
  vendor: string;
  series: string;
  model: string;
  hw_version: string;
  hw_type: string;
  hw_id: string;
  device: string;
  region: string;
  description: string;
}
