import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
export default defineConfig(({mode})=>({
  base:'./',
  define:mode==='pages'?{'process.env.NODE_ENV':JSON.stringify('production')}:{},
  plugins:[react()],
  resolve:{alias:{'@':fileURLToPath(new URL('.',import.meta.url))}},
  server:{host:'127.0.0.1',allowedHosts:['localhost'],watch:{usePolling:true}},
  build:{outDir:mode==='pages'?'dist/pages':'dist/local',emptyOutDir:true,...(mode==='pages'?{lib:{entry:'client/site.tsx',name:'ArtistAtlas',formats:['iife'],fileName:'atlas'},cssCodeSplit:false}:{rollupOptions:{input:['site.html','admin.html']}})},
}));
