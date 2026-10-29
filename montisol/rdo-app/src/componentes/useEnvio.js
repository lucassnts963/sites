/* Envio de arquivos pelo menu de compartilhar do celular.
   Preparar as fotos (carimbar a legenda) leva um instante; se o navegador recusar por ter passado o tempo do toque,
   os arquivos ficam prontos e o próximo toque envia na hora. Sem suporte (computador): baixa os arquivos e copia o texto. */
import { useRef } from 'react';
import { useApp } from '../estado.jsx';
import { baixar, compartilharArquivos, copiar } from '../lib/arquivos.js';

export function useEnvio() {
  const { toast } = useApp();
  const pronto = useRef(null);
  return async (chave, preparar) => {
    try {
      let p = pronto.current && pronto.current.chave === chave ? pronto.current : null;
      if (!p) p = { chave, ...(await preparar()) };
      const r = await compartilharArquivos(p.files, { text: p.text, title: p.title });
      if (r === 'sem-gesto') { pronto.current = p; toast('Pronto: toque de novo para enviar'); return; }
      pronto.current = null;
      if (r === 'enviado') toast('Enviado');
      else if (r === 'sem-suporte') {
        p.files.forEach(baixar);
        if (p.text) await copiar(p.text);
        toast(`Este navegador não compartilha arquivos: ${p.files.length} arquivo(s) baixado(s)${p.text ? ' e texto copiado' : ''}`);
      }
    } catch (e) { pronto.current = null; toast('Não foi possível enviar: ' + e.message); }
  };
}
