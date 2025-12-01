export interface ShowVersionResponse {
  arch: string;
  bsp: {
    exact: string;
    cdate: string;
  };
  description: string;
  device: string;
  hw_id: string;
  hw_type: 'router' | 'extender';
  hw_version: string;
  manufacturer: string;
  model: string;
  ndm: {
    exact: string;
    cdate: string;
  };
  cdate: string;
  exact: string;
  ndw: {
    version: string;
    features: string;
    components: string;
  };
  region: string;
  release: string;
  sandbox: string;
  series: string;
  title: string;
  vendor: string;
}
