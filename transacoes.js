/* ════════════════════════════════════════════════════════════
   transacoes.js  —  Página de Transações
   Responsabilidade: listagem, modal de adição/edição,
   validação e salvamento das movimentações financeiras.
════════════════════════════════════════════════════════════ */

/* ── ESTADO ── */
let editandoTransId = null;

const transOrdenacao = { col: 'data_contabil', dir: 'desc' };

/* ── COLUNAS DA TABELA ── */
const TRANS_COLUNAS = [
  { chave: 'data_contabil',     label: 'Dt. Contábil',    w: 110 },
  { chave: 'data_competencia',  label: 'Dt. Competência', w: 120 },
  { chave: 'cartao',            label: 'Cartão',          w: 120 },
  { chave: 'tipo_pagamento',    label: 'Tipo Pgto.',      w: 110 },
  { chave: 'forma_pagamento',   label: 'Forma Pgto.',     w: 110 },
  { chave: 'descricao',         label: 'Descrição',       w: 180 },
  { chave: 'descricao_tratada', label: 'Desc. Tratada',   w: 150 },
  { chave: 'perfil_despesa',    label: 'Perfil',          w: 110 },
  { chave: 'categoria',         label: 'Categoria',       w: 120 },
  { chave: 'subcategoria',      label: 'Subcategoria',    w: 120 },
  { chave: 'status_compra',     label: 'Status',          w: 110 },
  { chave: 'valor',             label: 'Valor (R$)',      w: 110 },
  { chave: 'parcelado',         label: 'Parcelado',       w: 90  },
  { chave: 'parcelas',          label: 'Parcelas',        w: 90  },
];

/* ────────────────────────────────────────────
   RENDERIZA LISTA DE TRANSAÇÕES
──────────────────────────────────────────── */
function renderTransacoes() {
  const busca = (document.getElementById('transSearch')?.value || '').toLowerCase();

  // Carrega e enriquece com nomes das tabelas de apoio
  let dados = dbLoad('transacoes').map(t => ({
    ...t,
    cartao:          dbLoad('cartoes').find(x => x.id === t.cartao_id)?.nome || '',
    tipo_pagamento:  dbLoad('tipos').find(x => x.id === t.tipo_pagamento_id)?.nome || '',
    forma_pagamento: dbLoad('formas').find(x => x.id === t.forma_pagamento_id)?.nome || '',
    perfil_despesa:  dbLoad('perfis').find(x => x.id === t.perfil_despesa_id)?.nome || '',
    categoria:       dbLoad('categorias').find(x => x.id === t.categoria_id)?.nome || '',
    subcategoria:    dbLoad('subcategorias').find(x => x.id === t.subcategoria_id)?.nome || '',
    status_compra:   dbLoad('status').find(x => x.id === t.status_compra_id)?.nome || '',
    parcelas:        t.parcelado === 'Sim' ? `${t.parcela_atual}/${t.parcela_maxima}` : '—',
  }));

  // Filtra pela busca
  if (busca) {
    dados = dados.filter(t =>
      Object.values(t).some(v => String(v).toLowerCase().includes(busca))
    );
  }

  // Ordena
  dados.sort((a, b) => {
    const ord = transOrdenacao;
    if (ord.col === 'valor') {
      const av = parseFloat(a.valor) || 0;
      const bv = parseFloat(b.valor) || 0;
      return ord.dir === 'asc' ? av - bv : bv - av;
    }
    const av = (a[ord.col] || '').toString().toLowerCase();
    const bv = (b[ord.col] || '').toString().toLowerCase();
    return ord.dir === 'asc' ? av.localeCompare(bv, 'pt') : bv.localeCompare(av, 'pt');
  });

  // Estatísticas
  const todas   = dbLoad('transacoes');
  const total   = todas.reduce((s, t) => s + (parseFloat(t.valor) || 0), 0);
  document.getElementById('statsRow').innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Total de Lançamentos</div>
      <div class="stat-value blue">${todas.length}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Valor Total</div>
      <div class="stat-value green">R$ ${fmtValor(total)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Exibindo</div>
      <div class="stat-value">${dados.length}</div>
    </div>`;

  document.getElementById('transCount').textContent = `${dados.length} registro(s)`;

  // Cabeçalho da tabela
  const th = document.getElementById('transHead');
  th.innerHTML = '';

  TRANS_COLUNAS.forEach(col => {
    const td = document.createElement('th');
    td.setAttribute('data-col', col.chave);
    td.style.minWidth  = col.w + 'px';
    td.style.position  = 'relative';

    const isAtiva = transOrdenacao.col === col.chave;
    if (isAtiva) {
      td.classList.add(transOrdenacao.dir === 'asc' ? 'sorted-asc' : 'sorted-desc');
    }

    td.innerHTML = `${col.label}<span class="sort-icon"></span><div class="resize-handle"></div>`;
    td.onclick = (e) => {
      if (e.target.classList.contains('resize-handle')) return;
      if (transOrdenacao.col === col.chave) {
        transOrdenacao.dir = transOrdenacao.dir === 'asc' ? 'desc' : 'asc';
      } else {
        transOrdenacao.col = col.chave;
        transOrdenacao.dir = 'asc';
      }
      renderTransacoes();
    };
    th.appendChild(td);
  });

  const thAcoes = document.createElement('th');
  thAcoes.textContent = 'Ações';
  thAcoes.style.width = '90px';
  thAcoes.style.textAlign = 'right';
  th.appendChild(thAcoes);

  initResizable(th);

  // Corpo da tabela
  const tb = document.getElementById('transBody');
  if (dados.length === 0) {
    tb.innerHTML = `<tr class="empty-row">
      <td colspan="${TRANS_COLUNAS.length + 1}">
        Nenhuma movimentação encontrada. Clique em "Adicionar Movimentação".
      </td>
    </tr>`;
    return;
  }

  tb.innerHTML = dados.map(t => `
    <tr>
      <td>${fmtDateStr(t.data_contabil)}</td>
      <td>${fmtDateStr(t.data_competencia)}</td>
      <td>${escHtml(t.cartao)}</td>
      <td>${escHtml(t.tipo_pagamento)}</td>
      <td>${escHtml(t.forma_pagamento)}</td>
      <td title="${escHtml(t.descricao)}">${escHtml(t.descricao)}</td>
      <td title="${escHtml(t.descricao_tratada)}">${escHtml(t.descricao_tratada)}</td>
      <td>${escHtml(t.perfil_despesa)}</td>
      <td>${escHtml(t.categoria)}</td>
      <td>${escHtml(t.subcategoria)}</td>
      <td><span class="badge badge-gray">${escHtml(t.status_compra)}</span></td>
      <td class="val-positive">R$ ${fmtValor(parseFloat(t.valor) || 0)}</td>
      <td><span class="badge ${t.parcelado === 'Sim' ? 'badge-blue' : 'badge-gray'}">${t.parcelado}</span></td>
      <td>${t.parcelas}</td>
      <td class="actions">
        <div class="actions-cell">
          <button class="btn btn-icon btn-sm edit" title="Editar"
                  onclick="editarTransacao('${t.id}')">✎</button>
          <button class="btn btn-icon btn-sm del"  title="Excluir"
                  onclick="excluirTransacao('${t.id}')">🗑</button>
        </div>
      </td>
    </tr>`).join('');
}

/* ────────────────────────────────────────────
   ABRE O MODAL
──────────────────────────────────────────── */
function openTransacaoModal(id = null) {
  editandoTransId = id;

  document.getElementById('transModalTitle').textContent =
    id ? 'Editar Movimentação' : 'Adicionar Movimentação';

  preencherSelects();
  limparFormTransacao();

  if (id) {
    const t = dbLoad('transacoes').find(x => x.id === id);
    if (t) preencherFormTransacao(t);
  }

  document.getElementById('transModal').classList.add('open');
}

function closeTransModal() {
  document.getElementById('transModal').classList.remove('open');
  editandoTransId = null;
}

/* ────────────────────────────────────────────
   EDITAR / EXCLUIR
──────────────────────────────────────────── */
function editarTransacao(id)  { openTransacaoModal(id); }

function excluirTransacao(id) {
  const item = dbLoad('transacoes').find(x => x.id === id);
  openConfirm(`Excluir "${item?.descricao || ''}"?`, () => {
    dbDelete('transacoes', id);
    renderTransacoes();
    toast('Movimentação excluída.', 'warn');
  });
}

/* ────────────────────────────────────────────
   PREENCHE OS SELECTS COM DADOS DE CONFIGURAÇÃO
──────────────────────────────────────────── */
function preencherSelects() {
  const mapa = {
    'f-cartao':          'cartoes',
    'f-tipo-pagamento':  'tipos',
    'f-forma-pagamento': 'formas',
    'f-perfil-despesa':  'perfis',
    'f-categoria':       'categorias',
    'f-subcategoria':    'subcategorias',
    'f-status-compra':   'status',
  };

  Object.entries(mapa).forEach(([selectId, colecao]) => {
    const sel   = document.getElementById(selectId);
    const atual = sel.value;

    sel.innerHTML = '<option value="">Selecione…</option>';

    dbLoad(colecao)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))
      .forEach(item => {
        sel.innerHTML += `<option value="${item.id}">${escHtml(item.nome)}</option>`;
      });

    if (atual) sel.value = atual;
  });
}

/* ────────────────────────────────────────────
   LIMPA O FORMULÁRIO
──────────────────────────────────────────── */
function limparFormTransacao() {
  const campos = [
    'f-data-contabil', 'f-data-competencia', 'f-cartao',
    'f-tipo-pagamento', 'f-forma-pagamento', 'f-descricao',
    'f-descricao-tratada', 'f-perfil-despesa', 'f-categoria',
    'f-subcategoria', 'f-status-compra', 'f-valor',
    'f-parcelado', 'f-parcela-atual', 'f-parcela-maxima',
  ];
  campos.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  limparErros();
  document.getElementById('parcelasSection').classList.remove('visible');
}

/* ────────────────────────────────────────────
   PREENCHE O FORMULÁRIO (modo edição)
──────────────────────────────────────────── */
function preencherFormTransacao(t) {
  document.getElementById('f-data-contabil').value     = t.data_contabil || '';
  document.getElementById('f-data-competencia').value  = t.data_competencia || '';
  document.getElementById('f-cartao').value            = t.cartao_id || '';
  document.getElementById('f-tipo-pagamento').value    = t.tipo_pagamento_id || '';
  document.getElementById('f-forma-pagamento').value   = t.forma_pagamento_id || '';
  document.getElementById('f-descricao').value         = t.descricao || '';
  document.getElementById('f-descricao-tratada').value = t.descricao_tratada || '';
  document.getElementById('f-perfil-despesa').value    = t.perfil_despesa_id || '';
  document.getElementById('f-categoria').value         = t.categoria_id || '';
  document.getElementById('f-subcategoria').value      = t.subcategoria_id || '';
  document.getElementById('f-status-compra').value     = t.status_compra_id || '';
  document.getElementById('f-valor').value             = t.valor ? fmtValor(parseFloat(t.valor)) : '';
  document.getElementById('f-parcelado').value         = t.parcelado || '';

  if (t.parcelado === 'Sim') {
    document.getElementById('parcelasSection').classList.add('visible');
    document.getElementById('f-parcela-atual').value  = t.parcela_atual || '';
    document.getElementById('f-parcela-maxima').value = t.parcela_maxima || '';
  }
}

/* ────────────────────────────────────────────
   EXIBE / OCULTA CAMPOS DE PARCELA
──────────────────────────────────────────── */
function toggleParcelas() {
  const val = document.getElementById('f-parcelado').value;
  document.getElementById('parcelasSection').classList.toggle('visible', val === 'Sim');
}

/* ────────────────────────────────────────────
   SALVA A TRANSAÇÃO
──────────────────────────────────────────── */
function _transValorParecidoKey(valor) {
  const n = Math.abs(parseFloat(valor));
  return Number.isFinite(n) ? n.toFixed(2) : '';
}

function _transCampoParecidoKey(valor) {
  return valor === null || valor === undefined ? '' : String(valor);
}

function _transEncontrarTransacaoParecida(transacao, dados) {
  return (dados || []).find(item => {
    if (!item || item.id === transacao.id) return false;
    return _transCampoParecidoKey(item.data_contabil) === _transCampoParecidoKey(transacao.data_contabil)
      && _transCampoParecidoKey(item.data_competencia) === _transCampoParecidoKey(transacao.data_competencia)
      && _transCampoParecidoKey(item.cartao_id) === _transCampoParecidoKey(transacao.cartao_id)
      && _transCampoParecidoKey(item.categoria_id) === _transCampoParecidoKey(transacao.categoria_id)
      && _transCampoParecidoKey(item.subcategoria_id) === _transCampoParecidoKey(transacao.subcategoria_id)
      && _transValorParecidoKey(item.valor) === _transValorParecidoKey(transacao.valor);
  });
}

function saveTransacao(opts = {}) {
  limparErros();

  // Campos obrigatórios
  const obrigatorios = {
    'f-data-contabil':     { err: 'e-data-contabil',     label: 'Data Contábil' },
    'f-data-competencia':  { err: 'e-data-competencia',  label: 'Data Competência' },
    'f-cartao':            { err: 'e-cartao',            label: 'Cartão' },
    'f-tipo-pagamento':    { err: 'e-tipo-pagamento',    label: 'Tipo de Pagamento' },
    'f-forma-pagamento':   { err: 'e-forma-pagamento',   label: 'Forma de Pagamento' },
    'f-descricao':         { err: 'e-descricao',         label: 'Descrição' },
    'f-descricao-tratada': { err: 'e-descricao-tratada', label: 'Descrição Tratada' },
    'f-perfil-despesa':    { err: 'e-perfil-despesa',    label: 'Perfil da Despesa' },
    'f-categoria':         { err: 'e-categoria',         label: 'Categoria' },
    'f-subcategoria':      { err: 'e-subcategoria',      label: 'Subcategoria' },
    'f-status-compra':     { err: 'e-status-compra',     label: 'Status da Compra' },
    'f-valor':             { err: 'e-valor',             label: 'Valor' },
    'f-parcelado':         { err: 'e-parcelado',         label: 'Parcelado' },
  };

  let valido = true;
  Object.entries(obrigatorios).forEach(([fieldId, meta]) => {
    if (!document.getElementById(fieldId)?.value.trim()) {
      mostrarErro(fieldId, meta.err, `${meta.label} é obrigatório`);
      valido = false;
    }
  });

  // Validação de parcelas
  const parcelado = document.getElementById('f-parcelado').value;
  if (parcelado === 'Sim') {
    const pa = document.getElementById('f-parcela-atual').value;
    const pm = document.getElementById('f-parcela-maxima').value;
    if (!pa) { mostrarErro('f-parcela-atual',  'e-parcela-atual',  'Parcela atual obrigatória');  valido = false; }
    if (!pm) { mostrarErro('f-parcela-maxima', 'e-parcela-maxima', 'Parcela máxima obrigatória'); valido = false; }
    if (pa && pm && parseInt(pa) > parseInt(pm)) {
      mostrarErro('f-parcela-atual', 'e-parcela-atual', 'Parcela atual não pode ser maior que a máxima');
      valido = false;
    }
  }

  if (!valido) {
    toast('Preencha todos os campos obrigatórios.', 'error');
    return;
  }

  // Monta objeto da transação
  const valorRaw = document.getElementById('f-valor').value.replace(/\./g, '').replace(',', '.');
  const transacao = {
    id:                editandoTransId || uid(),
    data_contabil:     document.getElementById('f-data-contabil').value,
    data_competencia:  document.getElementById('f-data-competencia').value,
    cartao_id:         document.getElementById('f-cartao').value,
    tipo_pagamento_id: document.getElementById('f-tipo-pagamento').value,
    forma_pagamento_id:document.getElementById('f-forma-pagamento').value,
    descricao:         document.getElementById('f-descricao').value.trim(),
    descricao_tratada: document.getElementById('f-descricao-tratada').value.trim(),
    perfil_despesa_id: document.getElementById('f-perfil-despesa').value,
    categoria_id:      document.getElementById('f-categoria').value,
    subcategoria_id:   document.getElementById('f-subcategoria').value,
    status_compra_id:  document.getElementById('f-status-compra').value,
    valor:             parseFloat(valorRaw),
    parcelado:         parcelado,
    parcela_atual:     parcelado === 'Sim' ? document.getElementById('f-parcela-atual').value : '',
    parcela_maxima:    parcelado === 'Sim' ? document.getElementById('f-parcela-maxima').value : '',
  };

  // Insere ou atualiza
  let dados = dbLoad('transacoes');
  if (editandoTransId) {
    dados = dados.map(x => x.id === editandoTransId
      ? { ...x, ...transacao, updatedAt: new Date().toISOString() }
      : x
    );
    dbSave('transacoes', dados);
    toast('Movimentação atualizada com sucesso!');
  } else {
    if (!opts.ignorarAvisoParecida && _transEncontrarTransacaoParecida(transacao, dados)) {
      openConfirm(
        'Ja existe outra transacao muito parecida (mesma data, conta, categoria, subcategoria e valor).\nDeseja inserir a nova transacao mesmo assim?',
        () => saveTransacao({ ignorarAvisoParecida: true }),
        { label: 'Inserir mesmo assim', color: 'var(--primary)', icon: '⚠️' }
      );
      return;
    }
    transacao.createdAt = new Date().toISOString();
    dados.push(transacao);
    dbSave('transacoes', dados);
    toast('Movimentação adicionada com sucesso!');
  }

  closeTransModal();
  renderTransacoes();
}

/* ────────────────────────────────────────────
   ERROS DE VALIDAÇÃO
──────────────────────────────────────────── */
function mostrarErro(fieldId, errId, msg) {
  document.getElementById(fieldId)?.classList.add('error');
  const el = document.getElementById(errId);
  if (el) el.textContent = msg;
}

function limparErros() {
  document.querySelectorAll('.form-input, .form-select').forEach(el => el.classList.remove('error'));
  document.querySelectorAll('.form-error').forEach(el => el.textContent = '');
}
