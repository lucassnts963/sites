/* Arquivos, área de transferência e WhatsApp (APIs do navegador). */

export function baixar(file) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}

export const podeCompartilhar = (files) => !!(navigator.canShare && navigator.canShare({ files }));

/** Compartilha arquivos pelo menu do celular (WhatsApp etc.), com texto (vira legenda no WhatsApp).
    Devolve 'enviado', 'cancelado', 'sem-gesto' (o navegador exigiu um toque novo) ou 'sem-suporte'. */
export async function compartilharArquivos(files, { title, text } = {}) {
  if (!podeCompartilhar(files)) return 'sem-suporte';
  try {
    await navigator.share({ files, ...(title ? { title } : {}), ...(text ? { text } : {}) });
    return 'enviado';
  } catch (e) {
    if (e && e.name === 'AbortError') return 'cancelado';
    if (e && e.name === 'NotAllowedError') return 'sem-gesto';
    throw e;
  }
}

/** Compartilha pelo celular (se der) ou baixa o arquivo. Devolve o texto para o aviso. */
export async function compartilharArquivo(nome, texto, tipo) {
  const file = new File([texto], nome, { type: tipo });
  const r = await compartilharArquivos([file], { title: nome }).catch(() => 'sem-suporte');
  if (r === 'enviado') return 'Enviado';
  if (r === 'cancelado') return '';
  baixar(file);
  return 'Arquivo salvo: ' + nome;
}

/** Abre o seletor de arquivo e devolve { texto, nome } (ou null se cancelar). Com `binario`, devolve { arquivos: File[] }. */
export function abrirArquivo(accept, { binario = false, varios = false } = {}) {
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = accept;
    inp.multiple = varios;
    inp.onchange = async () => {
      const fs = [...inp.files];
      if (!fs.length) return resolve(null);
      resolve(binario ? { arquivos: fs } : { texto: await fs[0].text(), nome: fs[0].name });
    };
    inp.click();
  });
}

export async function copiar(txt) {
  try { await navigator.clipboard.writeText(txt); }
  catch (_) { const t = document.createElement('textarea'); t.value = txt; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
}

/** Abre o WhatsApp com a mensagem. Mensagens longas estouram o link: copia e abre o WhatsApp vazio. Devolve o aviso, se houver. */
export function enviarWhats(msg) {
  const url = 'https://wa.me/?text=' + encodeURIComponent(msg);
  if (url.length > 6000) { copiar(msg); window.open('https://wa.me/', '_blank'); return 'Mensagem longa copiada: cole no WhatsApp'; }
  window.open(url, '_blank');
  return '';
}
