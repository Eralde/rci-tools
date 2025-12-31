interface FwBlock {
  exact: string;
  cdate: string;
}

interface NdwBlock {
  version: string;
}

export interface ShowVersionResponse {
  release: string;
  sandbox?: string;
  title?: string;
  arch: string;
  ndm: FwBlock;
  bsp: FwBlock;
  ndw: {
    version?: string;
    features: string;
    components: string;
  };
  ndw3?: NdwBlock;
  ndw4?: NdwBlock;
  manufacturer: string;
  vendor: string;
  series: string;
  model: string;
  hw_version: string;
  hw_type?: string;
  hw_id: string;
  device: string;
  class?: string;
  region: string;
  description: string;
}
