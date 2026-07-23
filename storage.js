/* ════════════════════════════════════════════════════════════
   storage.js  —  Camada de dados (localStorage)
   Responsabilidade: ler e gravar dados no navegador.
   Futuramente: substituir pelo banco de dados real aqui.
════════════════════════════════════════════════════════════ */

/* ── CHAVES NO localStorage ── */
const STORAGE_KEYS = {
  cartoes:       'sc_cartoes',
  categorias:    'sc_categorias',
  subcategorias: 'sc_subcategorias',
  formas:        'sc_formas',
  tipos:         'sc_tipos',
  perfis:        'sc_perfis',
  status:        'sc_status',
  trabalhos:     'sc_trabalhos',
  transacoes:    'sc_transacoes',
};

/* ── LÊ uma coleção ── */
function dbLoad(colecao) {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS[colecao])) || [];
  } catch {
    return [];
  }
}

/* ── SALVA uma coleção ── */
function dbSave(colecao, dados) {
  localStorage.setItem(STORAGE_KEYS[colecao], JSON.stringify(dados));
}

/* ── INSERE um registro ── */
function dbInsert(colecao, registro) {
  const dados = dbLoad(colecao);
  dados.push({ ...registro, id: uid(), createdAt: new Date().toISOString() });
  dbSave(colecao, dados);
  return dados;
}

/* ── ATUALIZA um registro ── */
function dbUpdate(colecao, id, novosDados) {
  const dados = dbLoad(colecao).map(item =>
    item.id === id ? { ...item, ...novosDados, updatedAt: new Date().toISOString() } : item
  );
  dbSave(colecao, dados);
  return dados;
}

/* ── REMOVE um registro ── */
function dbDelete(colecao, id) {
  const dados = dbLoad(colecao).filter(item => item.id !== id);
  dbSave(colecao, dados);
  return dados;
}
