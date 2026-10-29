/* Banco do aparelho (IndexedDB "montisol-rdo"): fotos (imagens) e fila de envio para a base.
   Versão 2 acrescenta a fila; quem já tinha a versão 1 mantém as fotos. */
let dbP = null;
function db() {
  if (!dbP) {
    dbP = new Promise((ok, erro) => {
      const r = indexedDB.open('montisol-rdo', 2);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('fotos')) d.createObjectStore('fotos');
        if (!d.objectStoreNames.contains('fila')) d.createObjectStore('fila', { keyPath: 'id' });
      };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => erro(r.error);
    });
  }
  return dbP;
}

/** Roda fn(store) numa transação e devolve o resultado do pedido que fn retornar. */
export async function tx(nome, modo, fn) {
  const d = await db();
  return new Promise((ok, erro) => {
    const t = d.transaction(nome, modo);
    const res = fn(t.objectStore(nome));
    t.oncomplete = () => ok(res && 'result' in res ? res.result : undefined);
    t.onerror = () => erro(t.error);
  });
}
