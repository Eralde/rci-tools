export interface MwsNodeBase {
  id: string;
  name: string;
  mac: string;
  isController: boolean;
  isOnline: boolean;
  model: string;
}

export interface MwsClient {
  name: string;
  mac: string;
}

export interface MwsLink {
  type: 'wired' | 'wireless';
  node: MwsNodeBase;
}

export interface MwsNode extends MwsNodeBase {
  parent: MwsLink | null;
  clients: MwsClient[];
  children: MwsLink;
}
