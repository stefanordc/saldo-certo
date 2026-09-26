const test = require('node:test');
const assert = require('node:assert/strict');
const { select, getId, pendingDefaultSelection } = require('../js/default-account-utils.js');

test('selecting one account clears all other defaults', () => {
  const accounts = select([
    { id: 'a', padrao: true },
    { id: 'b', padrao: false },
  ], 'b', true);

  assert.deepEqual(accounts, [
    { id: 'a', padrao: false },
    { id: 'b', padrao: true },
  ]);
  assert.equal(getId(accounts), 'b');
});

test('clearing the selected account removes the default', () => {
  const accounts = select([{ id: 'a', padrao: true }], 'a', false);

  assert.equal(accounts[0].padrao, false);
  assert.equal(getId(accounts), '');
});

test('pending default selection never marks an account before the atomic RPC', () => {
  const account = pendingDefaultSelection({ id: 'b', nome: 'Conta B', padrao: true });

  assert.deepEqual(account, { id: 'b', nome: 'Conta B', padrao: false });
});
