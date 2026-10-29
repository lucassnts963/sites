/* Arquivos, área de transferência e WhatsApp (APIs do navegador). */

/** Compartilha pelo celular (se der) ou baixa o arquivo. Devolve o texto para o aviso. */
export async function compartilharArquivo(nome, texto, tipo) {
  const blob = new Blob([texto], { type: tipo });
  const file = new File([blob], nome, { type: tipo });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: nome }); return 'Enviado'; } catch (_) { /* cancelado: baixa o arquivo */ }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  return 'Arquivo salvo: ' + nome;
}

/** Abre o seletor de arquivo e devolve { texto, nome } (ou null se cancelar). */
export function abrirArquivo(accept) {
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = accept;
    inp.onchange = async () => { const f = inp.files[0]; resolve(f ? { texto: await f.text(), nome: f.name } : null); };
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
