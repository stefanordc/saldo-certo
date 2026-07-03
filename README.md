# 📂 Saldo Certo — Estrutura do Projeto

## Visão geral da pasta

```
SaldoCerto/
│
├── index.html          ← Estrutura visual (HTML puro)
│
├── css/
│   └── style.css       ← Aparência (cores, fontes, tamanhos)
│
└── js/
    ├── utils.js        ← Funções auxiliares (usadas por todos)
    ├── storage.js      ← Leitura e gravação de dados
    ├── config.js       ← Lógica da página Configurações
    ├── transacoes.js   ← Lógica da página Transações
    └── app.js          ← Ponto de entrada (inicialização)
```

---

## O que vai em cada arquivo?

### `index.html` — A estrutura
> Pense nele como o "esqueleto" da aplicação.

**Contém apenas:**
- Tags HTML (divs, botões, inputs, selects)
- Links para o CSS e para os JS
- Nenhum código de lógica, nenhuma cor definida aqui

**Regra:** Se você estiver escrevendo JavaScript ou CSS dentro do index.html, está no lugar errado.

---

### `css/style.css` — A aparência
> Pense nele como a "roupa" da aplicação.

**Contém:**
- Variáveis de cores (`--primary`, `--accent`...)
- Fontes, espaçamentos, bordas
- Animações e transições
- Layout (grid, flex)
- Estilos de todos os componentes (botões, tabelas, modals...)

**Regra:** Nenhuma lógica aqui. Apenas visual.

---

### `js/utils.js` — Funções auxiliares
> Funções genéricas que qualquer arquivo pode usar.

**Contém:**
- `uid()` → gera ID único
- `escHtml()` → protege contra injeção de HTML
- `fmtDateStr()` → formata datas para DD/MM/AAAA
- `fmtValor()` → formata números para R$ 1.234,56
- `maskValor()` → máscara do campo de valor
- `toast()` → notificação flutuante
- `openConfirm()` → modal de confirmação de exclusão
- `initResizable()` → colunas redimensionáveis

**Regra:** Deve ser carregado PRIMEIRO. Nenhuma referência a dados do app aqui.

---

### `js/storage.js` — Os dados
> A camada que fala com o banco de dados.

**Contém:**
- `dbLoad(colecao)` → lê dados
- `dbSave(colecao, dados)` → salva tudo
- `dbInsert(colecao, registro)` → adiciona 1 item
- `dbUpdate(colecao, id, dados)` → edita 1 item
- `dbDelete(colecao, id)` → remove 1 item

**Regra:** Quando conectar ao banco de dados real, você só mexe aqui.
Atualmente usa `localStorage` do navegador.

---

### `js/config.js` — Página de Configurações
> Toda a lógica das abas de cadastro (Cartões, Categorias, etc.)

**Contém:**
- `switchTab()` → troca de aba
- `renderizarAba()` → monta o HTML da aba
- `renderizarTabelaConfig()` → preenche a tabela com dados
- `adicionarConfig()` → salva novo item
- `excluirConfig()` → remove item
- `abrirEditarConfig()` → abre modal de edição
- `saveEditConfig()` → salva edição

---

### `js/transacoes.js` — Página de Transações
> Toda a lógica da listagem e do modal de movimentações.

**Contém:**
- `renderTransacoes()` → preenche a tabela
- `openTransacaoModal()` → abre o modal
- `closeTransModal()` → fecha o modal
- `preencherSelects()` → carrega os menus suspensos
- `saveTransacao()` → valida e salva
- `editarTransacao()` → abre modal no modo edição
- `excluirTransacao()` → remove movimentação
- `toggleParcelas()` → mostra/oculta campos de parcela

---

### `js/app.js` — Ponto de entrada
> O "gerente" que une tudo.

**Contém:**
- `showPage()` → navega entre Transações e Configurações
- Fecha modais ao clicar fora deles
- `DOMContentLoaded` → roda quando a página carrega

**Regra:** Deve ser carregado POR ÚLTIMO. Depende de todos os outros.

---

## Ordem de carregamento (no final do index.html)

```html
<script src="js/utils.js"></script>       ← 1º (sem dependências)
<script src="js/storage.js"></script>     ← 2º (usa uid() de utils)
<script src="js/config.js"></script>      ← 3º (usa storage + utils)
<script src="js/transacoes.js"></script>  ← 4º (usa storage + utils)
<script src="js/app.js"></script>         ← 5º (usa tudo)
```

> ⚠️ A ordem importa! Se você inverter, funções não existirão quando
> forem chamadas e o sistema vai quebrar.

---

## Como abrir o sistema

1. Abra a pasta `SaldoCerto/` no explorador de arquivos
2. Dê duplo clique em `index.html`
3. O sistema abrirá no seu navegador

## Como criar atalho na área de trabalho

**Windows:**
Clique com botão direito em `index.html` → Enviar para → Área de trabalho (criar atalho)

**Mac:**
Segure Option+Cmd e arraste o `index.html` para o Dock ou Desktop

---

## Quando conectar ao banco de dados

Você só precisará modificar o arquivo `js/storage.js`.
Substitua as funções `dbLoad`, `dbSave`, `dbInsert`, `dbUpdate` e `dbDelete`
por chamadas à sua API ou banco de dados local.
O resto do sistema continuará funcionando sem alterações.
