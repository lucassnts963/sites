/* Quando o ambiente não deixa compartilhar arquivo direto (mini app isolado do BeaconOS), oferece as saídas possíveis:
   baixar (pode ser bloqueado pelo ambiente), copiar o código da passagem, copiar o conteúdo de texto ou a mensagem.
   Se nem copiar der, mostra o texto selecionável para copiar à mão. */
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../estado.jsx';
import { baixar, copiar } from '../lib/arquivos.js';

const kb = (n) => (n < 1024 ? n + ' B' : (n / 1024).toFixed(n < 10240 ? 1 : 0).replace('.', ',') + ' KB');
const ehTexto = (f) => /^(text\/|application\/json)/.test(f.type);

export function OfertaArquivos() {
  const { oferta, setOferta, toast } = useApp();
  const ref = useRef(null);
  const [manual, setManual] = useState('');
  useEffect(() => {
    const d = ref.current;
    if (oferta && !d.open) d.showModal();
    if (!oferta && d.open) d.close();
    setManual('');
  }, [oferta]);
  const copiarOuMostrar = async (txt, rotulo) => {
    if (await copiar(txt)) toast(rotulo + ' copiado');
    else { setManual(txt); toast('Não deu para copiar aqui: selecione o texto e copie'); }
  };
  const copiarArquivo = async (f) => copiarOuMostrar(await f.text(), 'Conteúdo');
  return (
    <dialog ref={ref} onClose={() => setOferta(null)} className="oferta">
      {oferta && <>
        <h2 className="sem-margem">{oferta.titulo || 'Enviar'}</h2>
        <p className="dim pequeno">Aqui o celular não deixa compartilhar o arquivo direto. Use uma das opções:</p>
        {oferta.codigo && <div className="linha"><button type="button" className="btn pri" data-oferta="codigo" onClick={() => copiarOuMostrar(oferta.codigo, 'Código da passagem')}>📋 Copiar passagem (texto para o WhatsApp)</button></div>}
        {oferta.text && !oferta.codigo && <div className="linha"><button type="button" className="btn" data-oferta="texto" onClick={() => copiarOuMostrar(oferta.text, 'Texto')}>📋 Copiar a mensagem</button></div>}
        {(oferta.files || []).map((f) => (
          <div className="linha" key={f.name}>
            <button type="button" className="btn" data-oferta="baixar" onClick={() => baixar(f)}>⬇ Baixar {f.name} ({kb(f.size)})</button>
            {ehTexto(f) && !oferta.codigo && <button type="button" className="btn" data-oferta="copiar-arquivo" onClick={() => copiarArquivo(f)}>📋 Copiar conteúdo</button>}
          </div>
        ))}
        <p className="dim pequeno">Se o arquivo não baixar, o ambiente bloqueou o download: use copiar.</p>
        {manual && <textarea className="copiar-manual" readOnly value={manual} onFocus={(e) => e.target.select()} />}
        <div className="linha"><span className="sp" /><button type="button" className="btn" onClick={() => setOferta(null)}>Fechar</button></div>
      </>}
    </dialog>
  );
}
