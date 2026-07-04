const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');

const projectRoot = path.resolve(__dirname, '..');
const defaultSourceDir = path.resolve(projectRoot, '..', 'erp-financeiro-codex', 'erp-financeiro-classico');
const sourceDir = process.env.MYSQL_PROJECT_DIR || defaultSourceDir;
const sourceRequire = createRequire(path.join(sourceDir, 'package.json'));
const dotenv = sourceRequire('dotenv');
const mysql = sourceRequire('mysql2/promise');

dotenv.config({ path: path.join(sourceDir, '.env') });

const outputPath = process.env.OUTPUT_SQL || path.join(projectRoot, 'mysql_to_supabase_import.sql');
const outputDir = process.env.OUTPUT_DIR || path.join(projectRoot, 'mysql_to_supabase_import_parts');
const dbName = process.env.SALDO_CERTO_DB_NAME || 'saldo_certo_codex';

const IMPORT_USER_SQL = '(select id from auth.users order by created_at limit 1)';
const USER_ID = { raw: IMPORT_USER_SQL };
const UUID_NAMESPACE = 'b399a8d9-91dd-4b55-ae67-48fbd6d3501d';
const NATUREZA_PADRAO = [
  'Renda',
  'Neutro',
  'Transferência',
  'Supérfluo',
  'Conveniência',
  'Recuperação',
  'Essencial',
  'Qualidade de vida',
];
const DECISAO_PADRAO = [
  'Eventual',
  'Transferência',
  'Impulsivo',
  'Recorrente',
];

function bytesFromUuid(uuid) {
  return Buffer.from(uuid.replace(/-/g, ''), 'hex');
}

function deterministicUuid(scope, id) {
  const input = `${UUID_NAMESPACE}:${scope}:${String(id || '').trim()}`;
  const bytes = crypto.createHash('sha1').update(bytesFromUuid(UUID_NAMESPACE)).update(input).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function cleanText(value) {
  return String(value == null ? '' : value).trim();
}

function normalizedKey(value) {
  return cleanText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function uniqueNamesByNormalizedKey(names) {
  const map = new Map();
  for (const name of names) {
    const key = normalizedKey(name);
    if (key && !map.has(key)) map.set(key, name);
  }
  return Array.from(map.values());
}

function sqlValue(value) {
  if (value && typeof value === 'object' && value.raw) return value.raw;
  if (value === null || value === undefined || value === '') return 'null';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function titleFromKey(value) {
  return cleanText(value)
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/(^|\s)\S/g, (match) => match.toUpperCase())
    .replace('Variavel', 'Variável')
    .replace('Fixa', 'Fixa')
    .replace('Transferencia', 'Transferência');
}

function modalityLabel(value) {
  const normalized = cleanText(value).toLowerCase();
  const labels = {
    acao: 'Ação',
    fii: 'Fundo Imobiliário',
    fundo_imobiliario: 'Fundo Imobiliário',
    criptomoeda: 'Criptomoeda',
    etf: 'ETF',
    renda_fixa: 'Renda Fixa',
  };
  return labels[normalized] || titleFromKey(value || 'Outros');
}

function typePaymentKey(tipo) {
  const normalized = cleanText(tipo).toLowerCase();
  if (normalized === 'receita') return 'entrada';
  if (normalized === 'transferencia') return 'transferencia';
  if (normalized === 'investimento') return 'investimento';
  return 'saida';
}

function typePaymentLabel(key) {
  return {
    entrada: 'Entrada',
    saida: 'Saída',
    transferencia: 'Transferência',
    investimento: 'Investimento',
  }[key] || titleFromKey(key);
}

function dateOnly(value, fallback = null) {
  const text = cleanText(value);
  if (!text) return fallback;
  return text.slice(0, 10);
}

function dateTime(value) {
  const text = cleanText(value);
  if (!text) return null;
  return text.replace(' ', 'T');
}

function numberValue(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function boolValue(value) {
  return value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true';
}

function firstValue(...values) {
  return values.find((value) => cleanText(value)) || null;
}

function rowSql(row) {
  return `(${row.map(sqlValue).join(', ')})`;
}

function insertStatements(table, columns, rows, updateColumns = columns.filter((col) => col !== 'id'), chunkSize = 250) {
  if (!rows.length) return [];
  const chunks = [];
  for (let i = 0; i < rows.length; i += chunkSize) chunks.push(rows.slice(i, i + chunkSize));
  return chunks.map((chunk) => {
    const colSql = columns.map((col) => `"${col}"`).join(', ');
    const updateSql = updateColumns.length
      ? ` do update set ${updateColumns.map((col) => `"${col}" = excluded."${col}"`).join(', ')}`
      : ' do nothing';
    return [
      `insert into public.${table} (${colSql}) values`,
      chunk.map(rowSql).join(',\n'),
      `on conflict (id)${updateSql};`,
    ].join('\n');
  });
}

function insertSql(table, columns, rows, updateColumns = columns.filter((col) => col !== 'id'), chunkSize = 250) {
  const statements = insertStatements(table, columns, rows, updateColumns, chunkSize);
  return Array.isArray(statements) ? statements.join('\n\n') : statements;
}

function wrapPart(sql) {
  return [
    '-- Saldo Certo MySQL -> Supabase import part',
    '-- Run this file in Supabase SQL Editor, then run the next numbered file.',
    'begin;',
    '',
    "do $$ begin if not exists (select 1 from auth.users) then raise exception 'No auth.users row found for import'; end if; end $$;",
    '',
    sql,
    '',
    'commit;',
    '',
  ].join('\n');
}

async function readTable(connection, table) {
  const [rows] = await connection.query(`select * from \`${table}\``);
  return rows;
}

function idMap(scope, id, validIds = null) {
  const key = cleanText(id);
  if (!key) return null;
  if (validIds && !validIds.has(key)) return null;
  return deterministicUuid(scope, key);
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: dbName,
    dateStrings: true,
    decimalNumbers: true,
  });

  const [
    contas,
    categorias,
    subcategorias,
    formasPagamento,
    transacoes,
    ativosInvestimento,
    lancamentosInvestimento,
  ] = await Promise.all([
    readTable(connection, 'contas'),
    readTable(connection, 'categorias'),
    readTable(connection, 'subcategorias'),
    readTable(connection, 'formas_pagamento'),
    readTable(connection, 'transacoes'),
    readTable(connection, 'ativos_investimento'),
    readTable(connection, 'lancamentos_investimento'),
  ]);

  await connection.end();

  const contaIds = new Set(contas.map((row) => row.id));
  const categoriaIds = new Set(categorias.map((row) => row.id));
  const subcategoriaIds = new Set(subcategorias.map((row) => row.id));
  const formaIds = new Set(formasPagamento.map((row) => row.id));

  const typeKeys = Array.from(new Set([
    'entrada',
    'saida',
    'transferencia',
    ...transacoes.map((row) => typePaymentKey(row.tipo)),
  ]));
  const statusKeys = Array.from(new Set(transacoes.map((row) => cleanText(row.status) || 'pago')));
  const perfilDespesaKeys = Array.from(new Set(transacoes.map((row) => cleanText(row.perfil_despesa) || 'despesa_variavel')));
  const naturezaNames = uniqueNamesByNormalizedKey([
    ...NATUREZA_PADRAO,
    ...transacoes.map((row) => cleanText(row.natureza)).filter(Boolean),
  ]);
  const decisaoNames = uniqueNamesByNormalizedKey([
    ...DECISAO_PADRAO,
    ...transacoes.map((row) => cleanText(row.decisao)).filter(Boolean),
  ]);
  const corretoraNames = Array.from(new Set([
    ...ativosInvestimento.map((row) => cleanText(row.corretora)),
    ...lancamentosInvestimento.map((row) => cleanText(row.corretora)),
  ].filter(Boolean)));
  const modalidadeNames = Array.from(new Set([
    ...ativosInvestimento.map((row) => modalityLabel(row.modalidade)),
    ...lancamentosInvestimento.map((row) => modalityLabel(row.modalidade)),
  ].filter(Boolean)));

  const cartoesRows = contas.map((row) => [
    deterministicUuid('contas', row.id),
    cleanText(row.nome) || cleanText(row.codigo) || 'Conta',
    dateTime(row.criado_em),
    USER_ID,
  ]);

  const categoriaRows = categorias.map((row) => [
    deterministicUuid('categorias', row.id),
    cleanText(row.nome) || 'Categoria',
    dateTime(row.criado_em),
    USER_ID,
  ]);

  const subcategoriaRows = subcategorias.map((row) => [
    deterministicUuid('subcategorias', row.id),
    cleanText(row.nome) || 'Subcategoria',
    null,
    dateTime(row.criado_em),
    USER_ID,
  ]);

  const formaRows = formasPagamento.map((row) => [
    deterministicUuid('formas_pagamento', row.id),
    cleanText(row.nome) || 'Forma de pagamento',
    dateTime(row.criado_em),
    USER_ID,
  ]);

  const tipoRows = typeKeys.map((key) => [
    deterministicUuid('tipos_pagamento', key),
    typePaymentLabel(key),
    null,
    USER_ID,
  ]);

  const perfilRows = perfilDespesaKeys.map((key) => [
    deterministicUuid('perfis_despesa', key),
    titleFromKey(key),
    null,
    USER_ID,
  ]);

  const naturezaRows = naturezaNames.map((name) => [
    deterministicUuid('naturezas', normalizedKey(name)),
    name,
    null,
    USER_ID,
  ]);

  const decisaoRows = decisaoNames.map((name) => [
    deterministicUuid('decisoes', normalizedKey(name)),
    name,
    null,
    USER_ID,
  ]);

  const statusRows = statusKeys.map((key) => [
    deterministicUuid('status_compra', key),
    titleFromKey(key),
    null,
    USER_ID,
  ]);

  const corretoraRows = corretoraNames.map((name) => [
    deterministicUuid('corretoras', name.toLowerCase()),
    name,
    null,
    USER_ID,
  ]);

  const modalidadeRows = modalidadeNames.map((name) => [
    deterministicUuid('modalidades_inv', name.toLowerCase()),
    name,
    null,
    USER_ID,
  ]);

  const transacaoRows = transacoes.map((row) => {
    const tipoKey = typePaymentKey(row.tipo);
    const statusKey = cleanText(row.status) || 'pago';
    const perfilKey = cleanText(row.perfil_despesa) || 'despesa_variavel';
    const naturezaKey = cleanText(row.natureza)
      ? normalizedKey(row.natureza)
      : (tipoKey === 'transferencia' ? 'transferencia' : null);
    const decisaoKey = cleanText(row.decisao)
      ? normalizedKey(row.decisao)
      : (tipoKey === 'transferencia' ? 'transferencia' : null);
    const dataCompetencia = dateOnly(row.data) || dateOnly(row.data_baixa) || new Date().toISOString().slice(0, 10);
    const dataContabil = dateOnly(row.data_baixa) || dataCompetencia;
    return [
      deterministicUuid('transacoes', row.id),
      dataContabil,
      dataCompetencia,
      cleanText(row.descricao) || 'Sem descrição',
      cleanText(row.descricao_tratada) || cleanText(row.descricao) || 'Sem descrição',
      Math.abs(numberValue(row.valor)),
      boolValue(row.parcelado) ? 'Sim' : 'Não',
      Number(row.parcela_atual || 1),
      Number(row.parcela_maxima || 1),
      cleanText(row.observacoes) || null,
      true,
      idMap('contas', row.conta_id, contaIds),
      idMap('contas', firstValue(row.conta_destino_id, row.conta_destino, row.contaDestino), contaIds),
      deterministicUuid('tipos_pagamento', tipoKey),
      idMap('formas_pagamento', row.forma_pagamento, formaIds),
      deterministicUuid('perfis_despesa', perfilKey),
      naturezaKey ? deterministicUuid('naturezas', naturezaKey) : null,
      decisaoKey ? deterministicUuid('decisoes', decisaoKey) : null,
      idMap('categorias', row.categoria_id, categoriaIds),
      idMap('subcategorias', row.subcategoria_id, subcategoriaIds),
      deterministicUuid('status_compra', statusKey),
      dateTime(row.criado_em),
      USER_ID,
    ];
  });

  const movimentoRows = lancamentosInvestimento
    .filter((row) => cleanText(row.tipo) !== 'provento')
    .map((row) => {
      const corretora = cleanText(row.corretora);
      const modalidade = modalityLabel(row.modalidade);
      return [
        deterministicUuid('movimentos_inv', row.id),
        dateOnly(row.data) || new Date().toISOString().slice(0, 10),
        cleanText(row.tipo).toLowerCase() === 'venda' ? 'Venda' : 'Compra',
        cleanText(row.codigo) || 'SEM-TICKER',
        cleanText(row.nome_ativo) || cleanText(row.codigo) || 'Ativo',
        cleanText(row.setor) || null,
        cleanText(row.segmento) || null,
        Math.abs(numberValue(row.quantidade)),
        Math.abs(numberValue(row.preco_unitario)),
        Math.abs(numberValue(row.valor_total)),
        corretora ? deterministicUuid('corretoras', corretora.toLowerCase()) : null,
        null,
        dateTime(row.criado_em),
        USER_ID,
        modalidade,
        cleanText(row.observacoes) || null,
      ];
    });

  const dividendRows = lancamentosInvestimento
    .filter((row) => cleanText(row.tipo) === 'provento')
    .map((row) => [
      deterministicUuid('dividendos', row.id),
      dateOnly(row.data) || new Date().toISOString().slice(0, 10),
      cleanText(row.codigo) || 'SEM-TICKER',
      cleanText(row.nome_ativo) || null,
      null,
      null,
      modalityLabel(row.modalidade),
      Math.abs(numberValue(row.valor_total)),
      dateTime(row.criado_em),
      USER_ID,
      'Provento',
    ]);

  const sections = [
    '-- Generated by scripts/generate_mysql_to_supabase_import_sql.js',
    `-- Source MySQL database: ${dbName}`,
    '-- Run after supabase_clear_before_mysql_import.sql.',
    '-- The import user is the first auth.users row by created_at.',
    '',
    'begin;',
    '',
    "do $$ begin if not exists (select 1 from auth.users) then raise exception 'No auth.users row found for import'; end if; end $$;",
    '',
    insertSql('cartoes', ['id', 'nome', 'created_at', 'user_id'], cartoesRows),
    insertSql('categorias', ['id', 'nome', 'created_at', 'user_id'], categoriaRows),
    insertSql('subcategorias', ['id', 'nome', 'categoria_id', 'created_at', 'user_id'], subcategoriaRows),
    insertSql('formas_pagamento', ['id', 'nome', 'created_at', 'user_id'], formaRows),
    insertSql('tipos_pagamento', ['id', 'nome', 'created_at', 'user_id'], tipoRows),
    insertSql('perfis_despesa', ['id', 'nome', 'created_at', 'user_id'], perfilRows),
    insertSql('naturezas', ['id', 'nome', 'created_at', 'user_id'], naturezaRows),
    insertSql('decisoes', ['id', 'nome', 'created_at', 'user_id'], decisaoRows),
    insertSql('status_compra', ['id', 'nome', 'created_at', 'user_id'], statusRows),
    insertSql('corretoras', ['id', 'nome', 'created_at', 'user_id'], corretoraRows),
    insertSql('modalidades_inv', ['id', 'nome', 'created_at', 'user_id'], modalidadeRows),
    insertSql('transacoes', [
      'id',
      'data_contabil',
      'data_competencia',
      'descricao',
      'descricao_tratada',
      'valor',
      'parcelado',
      'parcela_atual',
      'parcela_maxima',
      'observacoes',
      'importado',
      'cartao_id',
      'conta_destino_id',
      'tipo_pagamento_id',
      'forma_pagamento_id',
      'perfil_despesa_id',
      'natureza_id',
      'decisao_id',
      'categoria_id',
      'subcategoria_id',
      'status_compra_id',
      'created_at',
      'user_id',
    ], transacaoRows),
    insertSql('movimentos_inv', [
      'id',
      'data',
      'tipo',
      'ticker',
      'empresa',
      'setor',
      'subsetor',
      'quantidade',
      'preco_unitario',
      'valor_total',
      'corretora_id',
      'modalidade_id',
      'created_at',
      'user_id',
      'modalidade',
      'observacoes',
    ], movimentoRows),
    insertSql('dividendos', [
      'id',
      'data',
      'ticker',
      'empresa',
      'setor',
      'subsetor',
      'modalidade',
      'valor',
      'created_at',
      'user_id',
      'tipo',
    ], dividendRows),
    '',
    'commit;',
    '',
    'select',
    "  (select count(*) from public.cartoes) as cartoes,",
    "  (select count(*) from public.categorias) as categorias,",
    "  (select count(*) from public.subcategorias) as subcategorias,",
    "  (select count(*) from public.naturezas) as naturezas,",
    "  (select count(*) from public.decisoes) as decisoes,",
    "  (select count(*) from public.transacoes) as transacoes,",
    "  (select count(*) from public.movimentos_inv) as movimentos_inv,",
    "  (select count(*) from public.dividendos) as dividendos;",
    '',
  ].filter(Boolean);

  await fs.writeFile(outputPath, sections.join('\n\n'), 'utf8');

  const partImports = [
    { label: 'cartoes', table: 'cartoes', columns: ['id', 'nome', 'created_at', 'user_id'], rows: cartoesRows },
    { label: 'categorias', table: 'categorias', columns: ['id', 'nome', 'created_at', 'user_id'], rows: categoriaRows },
    { label: 'subcategorias', table: 'subcategorias', columns: ['id', 'nome', 'categoria_id', 'created_at', 'user_id'], rows: subcategoriaRows },
    { label: 'formas_pagamento', table: 'formas_pagamento', columns: ['id', 'nome', 'created_at', 'user_id'], rows: formaRows },
    { label: 'tipos_pagamento', table: 'tipos_pagamento', columns: ['id', 'nome', 'created_at', 'user_id'], rows: tipoRows },
    { label: 'perfis_despesa', table: 'perfis_despesa', columns: ['id', 'nome', 'created_at', 'user_id'], rows: perfilRows },
    { label: 'naturezas', table: 'naturezas', columns: ['id', 'nome', 'created_at', 'user_id'], rows: naturezaRows },
    { label: 'decisoes', table: 'decisoes', columns: ['id', 'nome', 'created_at', 'user_id'], rows: decisaoRows },
    { label: 'status_compra', table: 'status_compra', columns: ['id', 'nome', 'created_at', 'user_id'], rows: statusRows },
    { label: 'corretoras', table: 'corretoras', columns: ['id', 'nome', 'created_at', 'user_id'], rows: corretoraRows },
    { label: 'modalidades_inv', table: 'modalidades_inv', columns: ['id', 'nome', 'created_at', 'user_id'], rows: modalidadeRows },
    {
      label: 'transacoes',
      table: 'transacoes',
      chunkSize: 120,
      columns: [
        'id',
        'data_contabil',
        'data_competencia',
        'descricao',
        'descricao_tratada',
        'valor',
        'parcelado',
        'parcela_atual',
        'parcela_maxima',
        'observacoes',
        'importado',
        'cartao_id',
        'conta_destino_id',
        'tipo_pagamento_id',
        'forma_pagamento_id',
        'perfil_despesa_id',
        'natureza_id',
        'decisao_id',
        'categoria_id',
        'subcategoria_id',
        'status_compra_id',
        'created_at',
        'user_id',
      ],
      rows: transacaoRows,
    },
    {
      label: 'movimentos_inv',
      table: 'movimentos_inv',
      columns: [
        'id',
        'data',
        'tipo',
        'ticker',
        'empresa',
        'setor',
        'subsetor',
        'quantidade',
        'preco_unitario',
        'valor_total',
        'corretora_id',
        'modalidade_id',
        'created_at',
        'user_id',
        'modalidade',
        'observacoes',
      ],
      rows: movimentoRows,
    },
    {
      label: 'dividendos',
      table: 'dividendos',
      columns: [
        'id',
        'data',
        'ticker',
        'empresa',
        'setor',
        'subsetor',
        'modalidade',
        'valor',
        'created_at',
        'user_id',
        'tipo',
      ],
      rows: dividendRows,
    },
  ];

  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });

  const manifest = [];
  let part = 1;
  for (const item of partImports) {
    const statements = insertStatements(item.table, item.columns, item.rows, item.columns.filter((col) => col !== 'id'), item.chunkSize || 250);
    if (!statements.length) continue;

    for (let index = 0; index < statements.length; index += 1) {
      const statement = statements[index];
      const suffix = statements.length > 1 ? `_${String(index + 1).padStart(2, '0')}` : '';
      const filename = `${String(part).padStart(3, '0')}_${item.label}${suffix}.sql`;
      manifest.push(filename);
      await fs.writeFile(path.join(outputDir, filename), wrapPart(statement), 'utf8');
      part += 1;
    }
  }

  const countsFilename = `${String(part).padStart(3, '0')}_conferencia.sql`;
  manifest.push(countsFilename);
  await fs.writeFile(path.join(outputDir, countsFilename), [
    'select',
    "  (select count(*) from public.cartoes) as cartoes,",
    "  (select count(*) from public.categorias) as categorias,",
    "  (select count(*) from public.subcategorias) as subcategorias,",
    "  (select count(*) from public.formas_pagamento) as formas_pagamento,",
    "  (select count(*) from public.tipos_pagamento) as tipos_pagamento,",
    "  (select count(*) from public.perfis_despesa) as perfis_despesa,",
    "  (select count(*) from public.naturezas) as naturezas,",
    "  (select count(*) from public.decisoes) as decisoes,",
    "  (select count(*) from public.status_compra) as status_compra,",
    "  (select count(*) from public.corretoras) as corretoras,",
    "  (select count(*) from public.modalidades_inv) as modalidades_inv,",
    "  (select count(*) from public.transacoes) as transacoes,",
    "  (select count(*) from public.movimentos_inv) as movimentos_inv,",
    "  (select count(*) from public.dividendos) as dividendos;",
    '',
  ].join('\n'), 'utf8');

  await fs.writeFile(path.join(outputDir, 'RUN_ORDER.txt'), manifest.join('\n') + '\n', 'utf8');

  console.log(`SQL gerado em: ${outputPath}`);
  console.log(`Partes geradas em: ${outputDir}`);
  console.log(`cartoes: ${cartoesRows.length}`);
  console.log(`categorias: ${categoriaRows.length}`);
  console.log(`subcategorias: ${subcategoriaRows.length}`);
  console.log(`formas_pagamento: ${formaRows.length}`);
  console.log(`tipos_pagamento: ${tipoRows.length}`);
  console.log(`perfis_despesa: ${perfilRows.length}`);
  console.log(`naturezas: ${naturezaRows.length}`);
  console.log(`decisoes: ${decisaoRows.length}`);
  console.log(`status_compra: ${statusRows.length}`);
  console.log(`corretoras: ${corretoraRows.length}`);
  console.log(`modalidades_inv: ${modalidadeRows.length}`);
  console.log(`transacoes: ${transacaoRows.length}`);
  console.log(`movimentos_inv: ${movimentoRows.length}`);
  console.log(`dividendos: ${dividendRows.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
