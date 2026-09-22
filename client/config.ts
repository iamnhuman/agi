declare global { interface Window { __ATLAS_CONFIG__?: {siteUrl:string;adminUrl:string}; } }
export const isStaticSite = import.meta.env.MODE === 'pages';
export const siteUrl = window.__ATLAS_CONFIG__?.siteUrl || 'http://localhost:3333';
export const adminUrl = window.__ATLAS_CONFIG__?.adminUrl || 'http://localhost:3334';
export const catalogUrl = isStaticSite ? `${import.meta.env.BASE_URL}catalog.json` : '/api/catalog';

export const showLocalAdmin = !isStaticSite && ['localhost','127.0.0.1','[::1]'].includes(window.location.hostname);
