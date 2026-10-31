// @vitest-environment jsdom
/* Alvo interno do BeaconOS: compressão do localStorage, fila sem IndexedDB, fallback para memória, aviso de espaço,
   passagem como texto e dados embutidos (sem fetch). */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { carregarApoio, codec, fila, imagens, lerDesenho, MARCA } from '../src/plataforma/beacon.js';
import { codigoPassagem, lerPassagem, TIPO_PASSAGEM } from '../src/lib/turnos.js';
import { _reiniciarArmazenamento, AVISO_BYTES, LS, modoArmazenamento, store, usoArmazenamento } from '../src/lib/store.js';

const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
afterEach(() => { if (original) Object.defineProperty(globalThis, 'localStorage', original); _reiniciarArmazenamento(); localStorage.clear(); });
beforeEach(() => { _reiniciarArmazenamento(); localStorage.clear(); });

describe('plataforma beacon', () => {
  it('não usa IndexedDB: fila e imagens ficam a cargo do localStorage / não são guardadas', () => {
    expect(fila).toBeNull();
    expect(imagens).toBeNull();
    expect(MARCA).toBe('marca/');
  });
  it('dados embutidos: catálogo, TAGs e efetivo de EXEMPLO (sem nomes reais)', async () => {
    const a = await carregarApoio();
    expect(a.efetivoSite).toBeNull();
    expect(a.efetivoExemplo.fonte).toMatch(/EXEMPLO/);
    expect(a.catalogo.desenhos.length).toBe(4);
    expect(a.trocadores.trocadores[0].tag).toBe('HE 41A-01A');
  });
  it('desenhos embutidos como texto SVG', async () => {
    const a = await carregarApoio();
    for (const d of a.catalogo.desenhos) expect(await lerDesenho(d.arquivo)).toMatch(/<svg[\s\S]*data-tube/);
    await expect(lerDesenho('nao/existe.svg')).rejects.toThrow(/não está no app/);
  });
});

describe('codec LZ do localStorage', () => {
  it('ida e volta; comprime valores grandes e lê JSON antigo', () => {
    const grande = { ts: Object.fromEntries(Array.from({ length: 894 }, (_, i) => ['C1-' + i, [1761900000000 + i, 'lanc-abc', 'ENCARREGADO PPU EXEMPLO']])) };
    const g = codec.gravar(grande);
    expect(g.startsWith('\u0001z')).toBe(true);
    expect(g.length).toBeLessThan(JSON.stringify(grande).length / 4);
    expect(codec.ler(g)).toEqual(grande);
    expect(codec.ler(codec.gravar({ a: 1 }))).toEqual({ a: 1 }); // pequeno fica em JSON
    expect(codec.ler('{"velho":true}')).toEqual({ velho: true });
  });
});

describe('armazenamento', () => {
  it('localStorage bloqueado: cai para a memória e continua funcionando na sessão', () => {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new DOMException('sandboxed', 'SecurityError'); } });
    _reiniciarArmazenamento();
    expect(modoArmazenamento()).toBe('memoria');
    expect(store.set('registros', [{ id: 1 }])).toBe(true);
    expect(store.get('registros', [])).toEqual([{ id: 1 }]);
    expect(store.chaves('regis')).toEqual([LS + 'registros']);
    expect(usoArmazenamento().modo).toBe('memoria');
  });
  it('avisa perto do limite (~5 MB) e acusa quando o navegador recusa por falta de espaço', () => {
    expect(usoArmazenamento().perto).toBe(false);
    localStorage.setItem('outro-app', 'x'.repeat(AVISO_BYTES / 2)); // 2 bytes por caractere
    expect(usoArmazenamento()).toMatchObject({ perto: true, modo: 'local' });
    const cheio = { getItem: (k) => localStorage.getItem(k), removeItem: (k) => localStorage.removeItem(k), key: (i) => localStorage.key(i),
      get length() { return localStorage.length; }, setItem() { throw new DOMException('cheio', 'QuotaExceededError'); } };
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: cheio });
    _reiniciarArmazenamento();
    // sem conseguir gravar o teste, o backend vira memória (o app avisa); gravar direto devolve false
    expect(modoArmazenamento()).toBe('memoria');
  });
});

describe('passagem como texto', () => {
  it('código RDOP1 ida e volta, mesmo no meio de uma mensagem do WhatsApp com quebras de linha', () => {
    const p = { tipo: TIPO_PASSAGEM, tag: 'HE 41A-01A', de: 'ENC', mapa: { estado: Object.fromEntries(Array.from({ length: 894 }, (_, i) => ['t' + i, i % 2 ? 'desobstruido' : 'obstruido'])) }, turnos: [] };
    const c = codigoPassagem(p);
    expect(c.startsWith('RDOP1:')).toBe(true);
    expect(c.length).toBeLessThan(20000); // cabe numa mensagem do WhatsApp
    const msg = '🔁 *Passagem de turno – HE 41A-01A*\nPróximo encarregado: …\n\n' + c.slice(0, 50) + '\n' + c.slice(50);
    expect(lerPassagem(msg)).toEqual(p);
    expect(() => lerPassagem(c.slice(0, c.length - 40))).toThrow(/incompleto|JSON|Unexpected/);
  });
});
