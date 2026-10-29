/** Minutos entre dois horários "HH:MM" (passa da meia-noite se o fim for menor). */
export function minutos(ini, fim) {
  if (!ini || !fim) return null;
  const p = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  let d = p(fim) - p(ini);
  if (d < 0) d += 1440;
  return d;
}

export function resumoParadas(paradas) {
  const r = { total: 0, hydro: 0, montisol: 0, semHorario: 0 };
  for (const p of paradas || []) {
    const m = minutos(p.ini, p.fim);
    if (m == null) { r.semHorario++; continue; }
    r.total += m;
    if (p.resp === 'Hydro') r.hydro += m;
    else if (p.resp === 'Montisol') r.montisol += m;
  }
  return r;
}
