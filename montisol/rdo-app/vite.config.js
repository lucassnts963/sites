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

/* ---------------------------------------------------------------- alvo BeaconOS (npm run build:beacon -> ../rdo-beacon)
   Mini app interno: pasta autossuficiente, caminhos relativos, origem "null" (sandbox).
   - Script CLÁSSICO num arquivo só (IIFE): script de módulo, <link crossorigin> e fontes são pedidos em modo CORS,
     que falham em origem "null" se o servidor não liberar; script clássico, CSS e <img> não dependem disso.
   - Fontes embutidas no CSS (data:), JSON e SVG embutidos no script (plataforma/beacon.js), logos copiados para marca/.
   - Sem service worker e sem manifest. */
const MARCA_BEACON = ['logo-horizontal-branco.png', 'logo-vertical-colorido.png', 'favicon-64.png',
  ...['ferramentas', 'lupa', 'calendario', 'engrenagem', 'equipe-operarios', 'valvula-tubulacao', 'supervisor'].map((n) => `icones/${n}-preto.png`)];
const alvoBeacon = () => ({
  name: 'alvo-beacon',
  transformIndexHtml: {
    order: 'pre',
    handler: (html) => html
      .replace(/\s*<link rel="manifest"[^>]*>/, '')
      .replace(/\s*<link rel="apple-touch-icon"[^>]*>/, '')
      .replaceAll('../marca/', 'marca/'),
  },
  closeBundle() {
    const destino = path.resolve(import.meta.dirname, '../rdo-beacon/marca');
    for (const f of MARCA_BEACON) {
      fs.mkdirSync(path.dirname(path.join(destino, f)), { recursive: true });
      fs.copyFileSync(path.join(montisol, 'marca', f), path.join(destino, f));
    }
  },
});
// depois que o Vite injeta os assets: script clássico e sem crossorigin
const alvoBeaconHtml = () => ({
  name: 'alvo-beacon-html',
  transformIndexHtml: {
    order: 'post',
    handler(html) {
      const out = html
        .replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/, '<script defer src="$1"></script>')
        .replaceAll(' crossorigin', '');
      if (/type="module"|crossorigin|manifest/.test(out)) throw new Error('index.html do alvo beacon ainda tem módulo/crossorigin/manifest');
      return out;
    },
  },
});
const configBeacon = () => ({
  base: './',
  publicDir: false,
  plugins: [react(), alvoBeacon(), alvoBeaconHtml()],
  resolve: { alias: { '#plataforma': path.resolve(import.meta.dirname, 'src/plataforma/beacon.js') } },
  build: {
    outDir: '../rdo-beacon',
    emptyOutDir: true,
    modulePreload: false,
    cssCodeSplit: false,
    assetsInlineLimit: 200000, // fontes (woff2) viram data: no CSS
    rollupOptions: {
      output: { format: 'iife', entryFileNames: 'app.js', assetFileNames: (a) => (a.names || []).some((n) => n.endsWith('.css')) ? 'app.css' : 'assets/[name][extname]' },
    },
  },
});

export default defineConfig(({ command, mode }) => mode === 'beacon' ? configBeacon() : ({
  base: command === 'serve' ? '/rdo/' : './',
  plugins: [react(), dadosDoSite()],
  resolve: { alias: { '#plataforma': path.resolve(import.meta.dirname, 'src/plataforma/pages.js') } },
  // dados/ e desenhos/ ficam em montisol/, fora desta pasta (os testes do alvo beacon importam de lá)
  server: { fs: { allow: [montisol] } },
  build: {
    outDir: '../rdo',
    emptyOutDir: true,
    rollupOptions: {
      output: { entryFileNames: 'assets/app.js', chunkFileNames: 'assets/[name].js', assetFileNames: (a) => (a.names || []).some((n) => n.endsWith('.css')) ? 'assets/app.css' : 'assets/[name][extname]' },
    },
  },
  test: { environment: 'node' },
}));
