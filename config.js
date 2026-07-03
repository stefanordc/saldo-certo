/* ════════════════════════════════════════════════════════════
   config.js  —  Página de Configurações
   Responsabilidade: CRUD das tabelas de apoio
   (Cartões, Categorias, Subcategorias, etc.)
════════════════════════════════════════════════════════════ */

/* ── QUAL ABA ESTÁ ABERTA ── */
let abaAtiva = 'cartoes';

/* ── ESTADO DE ORDENAÇÃO POR ABA ── */
const configOrdenacao = {};

/* ── NOMES AMIGÁVEIS ── */
const CONFIG_LABELS = {
  cartoes:       'Cartão',
  categorias:    'Categoria',
  subcategorias: 'Subcategoria',
  formas:        'Forma de Pagamento',
  tipos:         'Tipo de Pagamento',
  perfis:        'Perfil da Despesa',
  status:        'Status da Compra',
};

/* ────────────────────────────────────────────
   TROCA DE ABA
──────────────────────────────────────────── */
function switchTab(chave, botao) {
  abaAtiva = chave;

  // Atualiza botões
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  botao.classList.add('active');

  // Renderiza conteúdo
  renderizarAba(chave);
}

/* ────────────────────────────────────────────
   RENDERIZA A ABA ATIVA
──────────────────────────────────────────── */
function renderizarAba(chave) {
  const container = document.getElementById('tabContent');

  container.innerHTML = `
    <div class="tab-content">
      <div class="section-header">
        <span class="section-title">${CONFIG_LABELS[chave]}</span>
      </div>

      <!-- Formulário de adição -->
      <div class="inline-add">
        <div class="form-group" style="flex:1; max-width:320px">
          <label class="form-label">Nome</label>
          <input type="text" class="form-input" id="inp-${chave}"
                 placeholder="Digite o nome e pressione Enter…"
                 onkeydown="if(event.key==='Enter') adicionarConfig('${chave}')">
        </div>
        <button class="btn btn-primary" onclick="adicionarConfig('${chave}')">
          Adicionar
        </button>
      </div>

      <!-- Tabela -->
      <div class="table-wrap">
        <table>
          <thead><tr id="th-${chave}"></tr></thead>
          <tbody id="tb-${chave}"></tbody>
        </table>
      </div>
    </div>
  `;

  renderizarTabelaConfig(chave);
}

/* ────────────────────────────────────────────
   RENDERIZA TABELA DE CONFIGURAÇÃO
──────────────────────────────────────────── */
function renderizarTabelaConfig(chave) {
  const dados = dbLoad(chave);
  const ord   = configOrdenacao[chave] || { col: 'nome', dir: 'asc' };

  // Ordenação
  const ordenados = [...dados].sort((a, b) => {
    const av = (a[ord.col] || '').toString().toLowerCase();
    const bv = (b[ord.col] || '').toString().toLowerCase();
    return ord.dir === 'asc'
      ? av.localeCompare(bv, 'pt')
      : bv.localeCompare(av, 'pt');
  });

  // Colunas
  const colunas = [
    { chave: 'nome',      label: 'Nome' },
    { chave: 'createdAt', label: 'Criado em' },
  ];

  // Cabeçalho
  const th = document.getElementById('th-' + chave);
  if (!th) return;
  th.innerHTML = '';

  colunas.forEach(col => {
    const td = document.createElement('th');
    td.style.position = 'relative';
    if (ord.col === col.chave) {
      td.classList.add(ord.dir === 'asc' ? 'sorted-asc' : 'sorted-desc');
    }
    td.innerHTML = `${col.label}<span class="sort-icon"></span><div class="resize-handle"></div>`;
    td.onclick = (e) => {
      if (e.target.classList.contains('resize-handle')) return;
      if (ord.col === col.chave) ord.dir = ord.dir === 'asc' ? 'desc' : 'asc';
      else { ord.col = col.chave; ord.dir = 'asc'; }
      configOrdenacao[chave] = ord;
      renderizarTabelaConfig(chave);
    };
    th.appendChild(td);
  });

  // Coluna de ações
  const thAcoes = document.createElement('th');
  thAcoes.textContent = 'Ações';
  thAcoes.style.width = '100px';
  thAcoes.style.textAlign = 'right';
  th.appendChild(thAcoes);

  initResizable(th);

  // Corpo
  const tb = document.getElementById('tb-' + chave);
  if (!tb) return;

  if (ordenados.length === 0) {
    tb.innerHTML = `<tr class="empty-row">
      <td colspan="3">Nenhum registro cadastrado. Adicione acima.</td>
    </tr>`;
    return;
  }

  tb.innerHTML = ordenados.map(item => `
    <tr>
      <td>${escHtml(item.nome)}</td>
      <td>${fmtDate(item.createdAt)}</td>
      <td class="actions">
        <div class="actions-cell">
          <button class="btn btn-icon btn-sm edit" title="Editar"
                  onclick="abrirEditarConfig('${chave}','${item.id}')">✎</button>
          <button class="btn btn-icon btn-sm del"  title="Excluir"
                  onclick="excluirConfig('${chave}','${item.id}')">🗑</button>
        </div>
      </td>
    </tr>`).join('');
}

/* ────────────────────────────────────────────
   ADICIONAR
──────────────────────────────────────────── */
function adicionarConfig(chave) {
  const inp = document.getElementById('inp-' + chave);
  const val = inp.value.trim();

  if (!val) {
    inp.focus();
    toast('Digite um nome para adicionar.', 'warn');
    return;
  }

  const dados = dbLoad(chave);
  const jaExiste = dados.some(x => x.nome.toLowerCase() === val.toLowerCase());
  if (jaExiste) {
    toast('Já existe um registro com este nome.', 'warn');
    return;
  }

  dbInsert(chave, { nome: val });
  inp.value = '';
  renderizarTabelaConfig(chave);
  toast(`"${val}" adicionado com sucesso!`);
}

/* ────────────────────────────────────────────
   EXCLUIR
──────────────────────────────────────────── */
function excluirConfig(chave, id) {
  const item = dbLoad(chave).find(x => x.id === id);
  openConfirm(`Excluir "${item?.nome}"?`, () => {
    dbDelete(chave, id);
    renderizarTabelaConfig(chave);
    toast('Registro excluído.', 'warn');
  });
}

/* ────────────────────────────────────────────
   EDITAR
──────────────────────────────────────────── */
function abrirEditarConfig(chave, id) {
  const item = dbLoad(chave).find(x => x.id === id);
  if (!item) return;

  document.getElementById('editConfigInp').value = item.nome;
  document.getElementById('editConfigKey').value = chave;
  document.getElementById('editConfigId').value  = id;
  document.getElementById('editConfigModal').classList.add('open');
}

function closeEditConfig() {
  document.getElementById('editConfigModal').classList.remove('open');
}

function saveEditConfig() {
  const inp   = document.getElementById('editConfigInp');
  const chave = document.getElementById('editConfigKey').value;
  const id    = document.getElementById('editConfigId').value;
  const val   = inp.value.trim();

  if (!val) { inp.focus(); return; }

  dbUpdate(chave, id, { nome: val });
  renderizarTabelaConfig(chave);
  closeEditConfig();
  toast('Registro atualizado!');
}
