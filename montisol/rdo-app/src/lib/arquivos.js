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

/** Copia o texto. Devolve false se o ambiente não deixar (ex.: mini app isolado): aí a tela mostra o texto para copiar à mão. */
export async function copiar(txt) {
  try { await navigator.clipboard.writeText(txt); return true; }
  catch (_) {
    try {
      const t = document.createElement('textarea'); t.value = txt; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      const ok = document.execCommand('copy'); t.remove();
      return !!ok;
    } catch (_e) { return false; }
  }
}

/** Abre o WhatsApp com a mensagem. Mensagens longas estouram o link: copia e abre o WhatsApp vazio.
    Se o ambiente bloquear a janela (mini app isolado), copia o texto e avisa; se nem copiar der, pede para mostrar o texto.
    Devolve { aviso, mostrar }. */
export async function enviarWhats(msg) {
  const url = 'https://wa.me/?text=' + encodeURIComponent(msg);
  const longa = url.length > 6000;
  let janela = null;
  try { janela = window.open(longa ? 'https://wa.me/' : url, '_blank'); } catch (_) { janela = null; }
  if (janela && !longa) return { aviso: '', mostrar: false };
  const copiou = await copiar(msg);
  if (!copiou) return { aviso: 'Não deu para abrir o WhatsApp nem copiar aqui: copie o texto da janela e cole no WhatsApp', mostrar: true };
  return { aviso: janela ? 'Mensagem longa copiada: cole no WhatsApp' : 'O WhatsApp não abriu aqui: a mensagem foi copiada. Abra o WhatsApp e cole.', mostrar: false };
}
