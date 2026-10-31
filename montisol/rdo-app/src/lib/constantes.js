export const VERSAO = '0.7.0';

export const ROTULO_ST = { presente: 'Presente', falta: 'Falta', ferias: 'Férias', afastado: 'Afastado' };
export const MOD_TXT = { ppu: 'PPU (desobstrução)', extra: 'Equipe extra (HH)', '6x4': 'Equipe fixa 6x4' };

// Turnos do contrato (Anexo A): PPU de segunda a sexta; equipe fixa 6x4 em três turnos; extras seguem ADM/Tarde/Noite.
export const TURNOS_POR = {
  ppu: ['ADM (07h30–17h24)', 'Tarde (15h30–00h50)', 'Noite (23h00–07h30)'],
  extra: ['ADM', 'Tarde', 'Noite'],
  '6x4': ['Turno 07h–15h', 'Turno 15h–23h', 'Turno 23h–07h'],
};
export const turnosDe = (mod) => TURNOS_POR[mod] || TURNOS_POR.ppu;

// Logos e ícones da identidade visual: no Pages, montisol/marca (compartilhada com a página inicial); no BeaconOS, marca/ dentro do app.
export { MARCA, ALVO } from '#plataforma';
