import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// O build vai para ../rdo (servido pelo GitHub Pages em /sites/montisol/rdo/).
// Nomes fixos (sem hash): o service worker em ../sw.js lista os arquivos para funcionar offline.
const montisol = path.resolve(import.meta.dirname, '..');

/** No `npm run dev`, serve ../dados e ../desenhos como o Pages serve (o app pede ../dados/ a partir de /rdo/). */
const dadosDoSite = () => ({
  name: 'dados-do-site',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const m = /^\/(dados|desenhos|marca)\/([^?]*)/.exec(req.url || '');
      if (!m) return next();
      const arq = path.join(montisol, m[1], decodeURIComponent(m[2]));
      if (!arq.startsWith(path.join(montisol, m[1])) || !fs.existsSync(arq) || fs.statSync(arq).isDirectory()) { res.statusCode = 404; return res.end(); }
      res.setHeader('Content-Type', arq.endsWith('.json') ? 'application/json' : arq.endsWith('.svg') ? 'image/svg+xml' : arq.endsWith('.png') ? 'image/png' : 'application/octet-stream');
      fs.createReadStream(arq).pipe(res);
    });
  },
});

export default defineConfig(({ command }) => ({
  base: command === 'serve' ? '/rdo/' : './',
  plugins: [react(), dadosDoSite()],
  build: {
    outDir: '../rdo',
    emptyOutDir: true,
    rollupOptions: {
      output: { entryFileNames: 'assets/app.js', chunkFileNames: 'assets/[name].js', assetFileNames: (a) => (a.names || []).some((n) => n.endsWith('.css')) ? 'assets/app.css' : 'assets/[name][extname]' },
    },
  },
  test: { environment: 'node' },
}));
