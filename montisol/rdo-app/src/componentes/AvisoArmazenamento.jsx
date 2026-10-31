/* Aviso fixo sobre o armazenamento do aparelho: bloqueado (dados só na memória) ou perto do limite (~5 MB). */
import { useApp } from '../estado.jsx';
import { usoArmazenamento } from '../lib/store.js';

const mb = (b) => (b / 1048576).toFixed(1).replace('.', ',');

export function AvisoArmazenamento() {
  useApp(); // relê a cada mudança (versao/regs no contexto)
  const u = usoArmazenamento();
  if (u.modo === 'memoria') {
    return <div className="aviso-armazenamento bloqueado" role="alert" data-armazenamento="memoria">
      ⚠ <b>Armazenamento do aparelho bloqueado.</b> Os lançamentos ficam só enquanto esta tela estiver aberta: envie para a base ou pelo WhatsApp antes de fechar.
    </div>;
  }
  if (u.perto) {
    return <div className="aviso-armazenamento cheio" role="alert" data-armazenamento="cheio">
      ⚠ <b>Armazenamento quase cheio:</b> {mb(u.bytes)} MB de ~{mb(u.limite)} MB. Faça backup e exclua registros antigos no Histórico.
    </div>;
  }
  return null;
}
