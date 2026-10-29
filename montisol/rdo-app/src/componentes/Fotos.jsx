/* Fotos com legenda de um equipamento (PPU) ou do lançamento (extra/6x4). `caminho` = lista de anexos no rascunho. */
import { useEffect, useState } from 'react';
import { useApp } from '../estado.jsx';
import { abrirArquivo } from '../lib/arquivos.js';
import { apagarFoto, carimbar, guardarFoto, lerFoto, MOMENTOS } from '../lib/fotos.js';
import { dataBR, getPath, setPath, slug } from '../lib/texto.js';
import { useEnvio } from './useEnvio.js';

const ROT = Object.fromEntries(MOMENTOS);

/** Rodapé gravado na foto: equipamento, data, turno e encarregado. */
export const rodapeDe = (D, tag) => [tag, dataBR(D.data), D.turno, D.encarregado].filter(Boolean).join(' · ');
const legendaCompleta = (a) => [ROT[a.momento], a.legenda && a.legenda.trim()].filter(Boolean).join(': ');

/** Prepara os arquivos (foto + legenda gravada) para enviar. */
export async function arquivosDasFotos(anexos, rodape, prefixo) {
  const files = [];
  for (const [i, a] of anexos.entries()) {
    const blob = await lerFoto(a.id);
    if (!blob) continue;
    const img = await carimbar(blob, legendaCompleta(a), rodape);
    files.push(new File([img], `${prefixo}-${String(i + 1).padStart(2, '0')}${a.momento ? '-' + a.momento : ''}.jpg`, { type: 'image/jpeg' }));
  }
  return files;
}
export const textoDasFotos = (titulo, anexos) => [titulo, ...anexos.map((a, i) => `${i + 1}. ${legendaCompleta(a) || 'sem legenda'}`)].join('\n');

function Miniatura({ id }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let u = '', vivo = true;
    lerFoto(id).then((b) => { if (b && vivo) { u = URL.createObjectURL(b); setUrl(u); } });
    return () => { vivo = false; if (u) URL.revokeObjectURL(u); };
  }, [id]);
  return url ? <img src={url} alt="" /> : <div className="sem-img">foto não encontrada</div>;
}

export function Fotos({ caminho, tag }) {
  const { D, mudar, toast } = useApp();
  const enviar = useEnvio();
  const anexos = getPath(D, caminho) || [];
  const rodape = rodapeDe(D, tag);
  const prefixo = `foto-${slug(tag || D.encarregado || 'rdo')}-${D.data}`;

  const adicionar = async () => {
    const r = await abrirArquivo('image/*', { binario: true, varios: true });
    if (!r) return;
    try {
      const novos = [];
      for (const f of r.arquivos) novos.push(await guardarFoto(f));
      mudar((d) => { const l = getPath(d, caminho) || []; l.push(...novos); setPath(d, caminho, l); });
      toast(`${novos.length} foto(s) anexada(s): escreva a legenda`);
    } catch (e) { toast('Não foi possível anexar: ' + e.message); }
  };
  const remover = (j) => {
    if (!confirm('Remover esta foto?')) return;
    const { id } = anexos[j];
    mudar((d) => { getPath(d, caminho).splice(j, 1); });
    apagarFoto(id).catch(() => {});
  };
  const enviarUma = (a, j) => enviar(`${a.id}|${a.momento}|${a.legenda}|${rodape}`, async () => {
    const files = await arquivosDasFotos([a], rodape, `${prefixo}-${j + 1}`);
    return { files, text: [legendaCompleta(a), rodape].filter(Boolean).join('\n') };
  });
  const enviarTodas = () => enviar(anexos.map((a) => a.id + a.momento + a.legenda).join('|') + rodape, async () => ({
    files: await arquivosDasFotos(anexos, rodape, prefixo),
    text: textoDasFotos(`📸 *Fotos${tag ? ' – ' + tag : ''}* – ${rodape}`, anexos),
  }));

  return (
    <div className="fotos">
      {anexos.map((a, j) => (
        <div className="foto" key={a.id}>
          <Miniatura id={a.id} />
          <div className="foto-campos">
            <div className="seg mini">
              {MOMENTOS.map(([val, rot]) => (
                <button type="button" key={val} className={a.momento === val ? 'on' : ''}
                  onClick={() => mudar((d) => { const x = getPath(d, caminho)[j]; x.momento = x.momento === val ? '' : val; })}>{rot}</button>
              ))}
            </div>
            <input placeholder="Legenda (ex.: colmeia 2 antes da lavagem)" value={a.legenda}
              onChange={(e) => { const val = e.target.value; mudar((d) => { getPath(d, caminho)[j].legenda = val; }); }} />
            <div className="linha">
              <button type="button" className="btn min wa" onClick={() => enviarUma(a, j)}>📲 Enviar</button>
              <span className="sp" />
              <button type="button" className="btn min perigo" onClick={() => remover(j)} aria-label="remover foto">🗑</button>
            </div>
          </div>
        </div>
      ))}
      <div className="linha">
        <button type="button" className="btn" onClick={adicionar}>📷 Anexar fotos</button>
        {anexos.length > 1 && <button type="button" className="btn wa" onClick={enviarTodas}>📲 Enviar as {anexos.length}</button>}
      </div>
      {anexos.length > 0 && <p className="dim pequeno">A legenda é gravada na foto e vai junto no WhatsApp. As fotos ficam neste aparelho.</p>}
    </div>
  );
}
