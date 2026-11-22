const blocked: typeof fetch = () => {
  throw new Error('outbound network is blocked in tests');
};

globalThis.fetch = blocked;
