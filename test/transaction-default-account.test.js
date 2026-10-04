const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const DefaultAccount = require('../js/default-account-utils.js');

const html = fs.readFileSync(require.resolve('../index.html'), 'utf8');
function functionSource(name) {
  const start = html.indexOf(`function ${name}(`);
  const end = html.indexOf('\nfunction ', start + 1);
  return html.slice(start, end).replace(/\/\*[\s\S]*?\*\//g, '');
}

function form(editing = null, accounts = [{ id: 'btg', nome: 'BTG', padrao: true }]) {
  const elements = new Map();
  const context = {
    DefaultAccount, editandoTransId: editing,
    document: { getElementById(id) {
      if (!elements.has(id)) elements.set(id, { value: '', classList: { remove() {} } });
      return elements.get(id);
    } },
    dbLoad: () => accounts,
    _transSetSelectValue: (id, collection, value) => { context.document.getElementById(id).value = value; },
    limparErros() {}, toggleContaDestinoTransacao() {},
    transRefreshSearchableSelects() {}, transRefreshSearchableSelect() {},
    _transAtualizarOpcoesContaDestino() {},
    _transStatusPagoId: () => 'pago', _transTipoSaidaId: () => 'saida',
    _transFormaIdDebito: () => 'debito', _transPerfilDespesaVariavelId: () => 'variavel',
  };
  vm.createContext(context);
  vm.runInContext(functionSource('_transAplicarContaPadrao'), context);
  vm.runInContext(functionSource('limparFormTransacao'), context);
  context.limparFormTransacao();
  return context.document.getElementById('f-cartao').value;
}

test('new ordinary transaction selects BTG as default account', () => {
  assert.equal(form(), 'btg');
});
test('editing does not apply the default over the saved account', () => {
  assert.equal(form('existing'), '');
});
test('new transaction without a default leaves account empty', () => {
  assert.equal(form(null, [{ id: 'btg', padrao: false }]), '');
});
