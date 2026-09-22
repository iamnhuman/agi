import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
export default defineConfig(({mode})=>({
  base:'./',
  plugins:[react()],
  resolve:{alias:{'@':fileURLToPath(new URL('.',import.meta.url))}},
  server:{host:'127.0.0.1',allowedHosts:['localhost'],watch:{usePolling:true}},
  build:{outDir:mode==='pages'?'dist/pages':'dist/local',emptyOutDir:true,rollupOptions:{input:mode==='pages'?['site.html']:['site.html','admin.html']}},
}));
