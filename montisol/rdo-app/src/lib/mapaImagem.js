/* Envio do mapeamento pelo WhatsApp.
   O WhatsApp recebe o SVG como "foto", não consegue abrir e o envio falha. Por isso o mapa vai de duas formas:
   - imagem PNG (cabeçalho com TAG, data e contagens + o espelho colorido), que o WhatsApp mostra como foto;
   - documento .html com o SVG dentro (abre em qualquer navegador; o SVG com data-status segue igual para o painel). */
import { DEFAULT_STATUS } from './mapa.js';
import { dataBR, esc } from './texto.js';
import { scriptPassagem } from './turnos.js';

/** Texto que acompanha o mapa no WhatsApp. */
export function legendaMapa(meta, c) {
  return [`🗺️ *Mapeamento ${meta.trocador || ''}* – ${dataBR(meta.data)}${meta.turno ? ' – ' + meta.turno : ''}`,
    meta.resp ? `👷 ${meta.resp}` : '',
    `🟢 Desobstruídos: ${c.desobstruido}${meta.desobstruidosTurno !== undefined && meta.desobstruidosTurno !== '' ? ` (no turno: ${meta.desobstruidosTurno})` : ''}`,
    `🔴 Obstruídos: ${c.obstruido} · ⚫ Tamponados: ${c.tamponado} · 🟠 Furados: ${c.furado}`,
    `⚪ Sem registro: ${c.semRegistro} de ${c.total}`].filter(Boolean).join('\n');
}

/** Converte o SVG exportado em PNG com cabeçalho. */
export async function mapaPng(svgTexto, sheet, meta, c, statuses) {
  const lista = statuses || DEFAULT_STATUS;
  const [, , vw, vh] = sheet.viewBox;
  const W = 1600;
  const esc_ = W / vw;
  const H = Math.round(vh * esc_);
  const cab = 150;
  const url = URL.createObjectURL(new Blob([svgTexto], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H + cab;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = '#16161a'; ctx.fillRect(0, 0, W, cab);
    ctx.fillStyle = '#ff7a3d'; ctx.fillRect(0, cab - 6, W, 6);
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.fillText(`${meta.trocador || 'Espelho'} · ${dataBR(meta.data)}${meta.turno ? ' · ' + meta.turno : ''}`, 30, 20);
    ctx.font = '30px system-ui, sans-serif';
    let x = 30;
    for (const s of lista) {
      ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(x + 14, 98, 14, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffffff88'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#ececf1';
      const t = `${s.label} ${c[s.value] || 0}`;
      ctx.fillText(t, x + 36, 82);
      x += 36 + ctx.measureText(t).width + 34;
    }
    ctx.drawImage(img, 0, cab, W, H);
    return await new Promise((ok, erro) => cv.toBlob((b) => (b ? ok(b) : erro(new Error('não foi possível gerar a imagem do mapa'))), 'image/png'));
  } finally { URL.revokeObjectURL(url); }
}

/** Documento HTML com o SVG dentro (o WhatsApp manda como documento). Com `passagem`, leva também os dados para o próximo
    encarregado importar (manutenção, mapa com quem marcou cada tubo, histórico turno a turno). O SVG é opcional. */
export function mapaHtml(svgTexto, meta, c, passagem) {
  const turnos = (passagem && passagem.turnos) || [];
  const linhas = turnos.slice(0, 30).map((t) => `<tr><td>${esc(dataBR(t.data))}</td><td>${esc(String(t.turno || '').split(' ')[0])}</td><td>${esc(t.encarregado)}</td><td>${esc(t.desobTurno || 0)}</td><td>${esc(t.acum || '')}</td><td>${esc(t.pend || '')}</td></tr>`).join('');
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${passagem ? 'Passagem de turno' : 'Mapeamento'} ${esc(meta.trocador)} ${esc(dataBR(meta.data))}</title>
<style>body{margin:0;font:16px system-ui,sans-serif;background:#fff;color:#16161a}header{padding:12px 14px;background:#16161a;color:#fff}
header p{margin:4px 0 0;color:#c9c9d4;font-size:14px}svg{display:block;width:100%;height:auto}
table{border-collapse:collapse;margin:12px 14px;font-size:14px}td,th{border-bottom:1px solid #ddd;padding:4px 8px;text-align:left}
.dica{margin:12px 14px;color:#555;font-size:14px}</style></head>
<body><header><b>${esc(meta.trocador)} · ${esc(dataBR(meta.data))}${meta.turno ? ' · ' + esc(meta.turno) : ''}</b>
<p>${esc(meta.resp || '')}${c ? ` · Desobstruídos ${c.desobstruido} · Obstruídos ${c.obstruido} · Tamponados ${c.tamponado} · Furados ${c.furado} · Sem registro ${c.semRegistro} de ${c.total}` : ''}</p></header>
${svgTexto || ''}
${passagem ? `<p class="dica">Passagem de turno: no RDO de campo, no equipamento ${esc(meta.trocador)}, toque em <b>📥 Receber passagem</b> e escolha este arquivo.</p>` : ''}
${linhas ? `<table><tr><th>Data</th><th>Turno</th><th>Encarregado</th><th>Desob. turno</th><th>Acumulado</th><th>Pendentes</th></tr>${linhas}</table>` : ''}
${passagem ? scriptPassagem(passagem) : ''}
</body></html>
`;
}
