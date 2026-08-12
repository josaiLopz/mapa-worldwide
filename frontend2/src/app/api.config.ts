const localHosts = ['localhost', '127.0.0.1'];
const isLocal = localHosts.includes(globalThis.location?.hostname || '');

export const API_ORIGIN = isLocal
  ? 'http://croquis-comercial.test'
  : 'https://api-mapa.worldwidegames.com.mx';

export const API_BASE = `${API_ORIGIN}/api`;
export const API_SESSION_SUFFIX = isLocal ? '_local' : '';
