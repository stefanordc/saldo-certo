# Calendários de Gastos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a monthly expense-calendar report and a persisted, exclusive default account for new transfers.

**Architecture:** Keep `index.html` as the application entry point and add two UMD-style utility files for pure, testable rules. Inline code will consume them to render the calendar, persist the exclusive default account, and preselect it only for a new transfer.

**Tech Stack:** HTML, CSS custom properties, browser JavaScript, Node.js built-in test runner, Supabase/Postgres.

**Spec:** `docs/superpowers/specs/2026-09-24-calendarios-de-gastos-design.md`

## Global Constraints

- Preserve all existing report tabs and transaction behavior.
- Name the new report tab exactly `Calendários de Gastos`.
- Support existing light and dark themes; do not copy the pink reference color.
- Default to the current reference month, all profiles, and excluded transfers.
- Identify transfers with the existing transfer helper rather than a description comparison.
- Persist `cartoes.padrao` as `boolean not null default false` and enforce one default per user.
- Apply the account only to an empty origin field in a new transfer; manual choices and edits win.

## Review Focus

- A 31-day month beginning on Saturday must align blank leading cells and its final day.
- Multiple transactions on one date must sum once, and zero-value days must not count as spending days.
- Transfers must be excluded by default and included only by the checkbox.
- Selecting a new default must clear every prior default without changing account identities.
- Changing a manually configured transaction into a transfer must not overwrite its account.

---

### Task 1: Calendar aggregation utility

**Files:**

- Create: `js/calendar-gastos-utils.js`
- Create: `test/calendar-gastos-utils.test.js`

**Interfaces:**

- Consumes normalized rows `{ date: 'YYYY-MM-DD', value: number }`.
- Produces `CalendarGastos.buildMonthGrid(monthKey, rows)`, which returns `{ year, monthIndex, days, total, spendingDays, maxDaily }`; `days` contains leading null cells plus `{ day, date, total, intensity }` records.

- [ ] **Step 1: Write the failing test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildMonthGrid } = require('../js/calendar-gastos-utils.js');

test('sums entries by day and reports only days with spending', () => {
  const result = buildMonthGrid('2026-09', [
    { date: '2026-09-11', value: 40 },
    { date: '2026-09-11', value: 60 },
    { date: '2026-09-15', value: 10 },
  ]);
  assert.equal(result.days.find(day => day?.date === '2026-09-11').total, 100);
  assert.equal(result.total, 110);
  assert.equal(result.spendingDays, 2);
});

test('aligns a Saturday-starting 31-day month and includes zero-value days', () => {
  const result = buildMonthGrid('2026-08', []);
  assert.deepEqual(result.days.slice(0, 6), [null, null, null, null, null, null]);
  assert.equal(result.days[6].date, '2026-08-01');
  assert.equal(result.days.find(day => day?.date === '2026-08-31').total, 0);
});
```

- [ ] **Step 2: Verify the test fails**

Run: `node --test test/calendar-gastos-utils.test.js`

Expected: FAIL because `js/calendar-gastos-utils.js` does not exist.

- [ ] **Step 3: Implement the minimal UMD utility**

```js
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CalendarGastos = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function buildMonthGrid(monthKey, rows) {
    const [year, month] = String(monthKey).split('-').map(Number);
    if (!Number.isInteger(year) || month < 1 || month > 12) throw new Error('Mês inválido');
    const daysInMonth = new Date(year, month, 0).getDate();
    const totals = new Map();
    (rows || []).forEach(({ date, value }) => {
      if (String(date).startsWith(monthKey)) totals.set(date, (totals.get(date) || 0) + Math.abs(Number(value) || 0));
    });
    const days = Array(new Date(year, month - 1, 1).getDay()).fill(null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = `${monthKey}-${String(day).padStart(2, '0')}`;
      days.push({ day, date, total: totals.get(date) || 0, intensity: 0 });
    }
    while (days.length % 7) days.push(null);
    const entries = days.filter(Boolean);
    const maxDaily = Math.max(0, ...entries.map(day => day.total));
    entries.forEach(day => { day.intensity = maxDaily ? day.total / maxDaily : 0; });
    return { year, monthIndex: month - 1, days, total: entries.reduce((sum, day) => sum + day.total, 0), spendingDays: entries.filter(day => day.total > 0).length, maxDaily };
  }
  return { buildMonthGrid };
});
```

- [ ] **Step 4: Verify the focused suite passes**

Run: `node --test test/calendar-gastos-utils.test.js`

Expected: PASS with 2 tests.

- [ ] **Step 5: Commit**

```bash
git add js/calendar-gastos-utils.js test/calendar-gastos-utils.test.js
git commit -m "feat: add calendar expense aggregation"
```

### Task 2: Default-account utility and Supabase schema

**Files:**

- Create: `js/default-account-utils.js`
- Create: `test/default-account-utils.test.js`
- Create: `supabase_migrations/20260924_add_conta_padrao.sql`
- Modify: `SaldoCerto_schema.sql`
- Modify: `index.html: _SB_COLS.cartoes`

**Interfaces:**

- Consumes account rows `{ id: string, padrao?: boolean }`.
- Produces `DefaultAccount.select(accounts, accountId, checked)` and `DefaultAccount.getId(accounts)`.
- Produces database field `cartoes.padrao` and partial unique index `cartoes_um_padrao_por_usuario_idx`.

- [ ] **Step 1: Write the failing test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { select, getId } = require('../js/default-account-utils.js');

test('selecting one account clears all other defaults', () => {
  const accounts = select([{ id: 'a', padrao: true }, { id: 'b', padrao: false }], 'b', true);
  assert.deepEqual(accounts, [{ id: 'a', padrao: false }, { id: 'b', padrao: true }]);
  assert.equal(getId(accounts), 'b');
});

test('clearing the selected account removes the default', () => {
  const accounts = select([{ id: 'a', padrao: true }], 'a', false);
  assert.equal(accounts[0].padrao, false);
  assert.equal(getId(accounts), '');
});
```

- [ ] **Step 2: Verify the test fails**

Run: `node --test test/default-account-utils.test.js`

Expected: FAIL because `js/default-account-utils.js` does not exist.

- [ ] **Step 3: Implement the utility and migration**

```js
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.DefaultAccount = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const same = (left, right) => String(left) === String(right);
  const select = (accounts, accountId, checked) => (accounts || []).map(account => ({
    ...account,
    padrao: checked ? same(account.id, accountId) : (same(account.id, accountId) ? false : !!account.padrao),
  }));
  const getId = accounts => String((accounts || []).find(account => account.padrao)?.id || '');
  return { select, getId };
});
```

```sql
alter table public.cartoes add column if not exists padrao boolean not null default false;
create unique index if not exists cartoes_um_padrao_por_usuario_idx
  on public.cartoes (user_id)
  where padrao;
```

Add `padrao` to the schema definition and `_SB_COLS.cartoes`, so the existing normalization and sync layer retain the property.

- [ ] **Step 4: Verify the focused suite and static persistence checks pass**

Run: `node --test test/default-account-utils.test.js; rg -n "padrao|cartoes_um_padrao_por_usuario_idx" SaldoCerto_schema.sql supabase_migrations/20260924_add_conta_padrao.sql index.html`

Expected: PASS with 2 tests and every persistence location listed.

- [ ] **Step 5: Commit**

```bash
git add js/default-account-utils.js test/default-account-utils.test.js supabase_migrations/20260924_add_conta_padrao.sql SaldoCerto_schema.sql index.html
git commit -m "feat: persist default account"
```

### Task 3: Integrate calendar, report filters, account UI, and transfer default

**Files:**

- Modify: `index.html: external scripts, Reports markup, report CSS, inline report/config/transaction functions`
- Modify: `test/calendar-gastos-utils.test.js`

**Interfaces:**

- Consumes `CalendarGastos.buildMonthGrid`, `DefaultAccount.select`, `DefaultAccount.getId`, `_relIsSaida`, `_relIncluirNosCalculos`, `_transIsTransferenciaLancamento`, `dbLoad`, and `dbSave`.
- Produces `renderRelCalendarioGastos()`, `_contaPadraoAlternar(contaId, checked)`, and `_transAplicarContaPadraoTransferencia()`.

- [ ] **Step 1: Write the failing transfer-selection test**

```js
const { selectRows } = require('../js/calendar-gastos-utils.js');

test('calendar aggregation excludes transfer rows until they are selected', () => {
  const rows = [
    { date: '2026-09-11', value: 10, transfer: false, profileId: 'essencial' },
    { date: '2026-09-11', value: 90, transfer: true, profileId: 'transferencia' },
  ];
  const excluded = buildMonthGrid('2026-09', selectRows(rows, { includeTransfers: false }));
  const included = buildMonthGrid('2026-09', selectRows(rows, { includeTransfers: true }));
  assert.equal(excluded.total, 10);
  assert.equal(included.total, 100);
});
```

- [ ] **Step 2: Verify the test fails**

Run: `node --test test/calendar-gastos-utils.test.js`

Expected: FAIL because `selectRows` is not yet exported.

- [ ] **Step 3: Implement the adapter and wire the application**

Add this utility before wiring the UI:

```js
function selectRows(rows, { includeTransfers = false, profileId = '' } = {}) {
  return (rows || []).filter(row =>
    (includeTransfers || !row.transfer) && (!profileId || String(row.profileId) === String(profileId))
  );
}
```

Export it from `CalendarGastos`. Load both utility scripts before the inline application script. Add the `Calendários de Gastos` tab button and `reltab-calendario-gastos` panel with: reference-month field, previous/current/next month buttons, `rcg-perfil`, `rcg-incluir-transferencias`, headline total, spending-day count, weekday labels, and `.rcg-calendar-grid`.

Add light/dark CSS for five intensity levels using current primary and accent variables. Implement `renderRelCalendarioGastos()` by filtering outgoing rows in the selected month, normalizing each one into `{ date: _transDataCompetencia(t), value: Math.abs(parseFloat(t.valor) || 0), transfer: _transIsTransferenciaLancamento(t), profileId: t.perfil_despesa_id }`, passing records through `CalendarGastos.selectRows`, then rendering the grid returned by `CalendarGastos.buildMonthGrid`.

Register the renderer in `_relRenders` and preserve the current active-tab behavior.

For `cartoes`, add a `Conta padrão` table column and checkbox. `_contaPadraoAlternar` must call `DefaultAccount.select(dbLoad('cartoes'), contaId, checked)`, `dbSave('cartoes', accounts)`, rerender the table, and issue a toast.

In the existing transfer-category change path, invoke `_transAplicarContaPadraoTransferencia()` only when `editandoTransId` is empty and `f-cartao` is empty. It must read `DefaultAccount.getId(dbLoad('cartoes'))`, set `f-cartao`, and refresh the searchable select.

- [ ] **Step 4: Verify unit, syntax, and whitespace checks**

Run: `node --test test/*.test.js; node --check js/calendar-gastos-utils.js; node --check js/default-account-utils.js; git diff --check`

Expected: every test passes, utilities parse, and no whitespace errors occur.

- [ ] **Step 5: Commit**

```bash
git add index.html js/calendar-gastos-utils.js js/default-account-utils.js test supabase_migrations SaldoCerto_schema.sql
git commit -m "feat: add expense calendar report"
```

### Task 4: Verify the database and full browser flow

**Files:**

- Modify: none unless verification exposes a defect.

**Interfaces:**

- Consumes: `supabase_migrations/20260924_add_conta_padrao.sql`, the browser app, and local HTTP server.
- Produces: verified account constraint and user-visible feature behavior.

- [ ] **Step 1: Apply the migration with the configured Supabase SQL workflow**

Run the migration in the project SQL environment. Do not expose service-role credentials in browser code.

- [ ] **Step 2: Verify the database state**

```sql
select column_name, data_type, column_default, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'cartoes' and column_name = 'padrao';

select indexname, indexdef
from pg_indexes
where schemaname = 'public' and tablename = 'cartoes'
  and indexname = 'cartoes_um_padrao_por_usuario_idx';
```

- [ ] **Step 3: Serve and inspect the local app**

Run: `python -m http.server 4173 --directory .`

Open `http://localhost:4173/index.html`. Validate empty and populated months, profile filter, transfer checkbox, exclusive default account, preselected transfer origin, preserved edits/manual choice, and both themes.

- [ ] **Step 4: Run final verification**

Run: `node --test test/*.test.js; git diff --check; git status --short`

Expected: all tests pass, no whitespace errors, and only intended files remain uncommitted.
