(function (root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) module.exports = api;
  root.DefaultAccount = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const same = (left, right) => String(left) === String(right);

  function select(accounts, accountId, checked) {
    return (accounts || []).map(account => ({
      ...account,
      padrao: checked
        ? same(account.id, accountId)
        : (same(account.id, accountId) ? false : !!account.padrao),
    }));
  }

  function getId(accounts) {
    return String((accounts || []).find(account => account.padrao)?.id || '');
  }

  function pendingDefaultSelection(account) {
    return { ...account, padrao: false };
  }

  return { select, getId, pendingDefaultSelection };
});
