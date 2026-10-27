export interface PvcPair {
  vpi: string;
  vci: string;
}

export const isPvcPair = (obj: unknown): obj is PvcPair => {
  return typeof obj === 'object'
    && obj !== null
    && 'vpi' in obj
    && 'vci' in obj
    && typeof obj.vpi === 'string'
    && typeof obj.vci === 'string';
};
