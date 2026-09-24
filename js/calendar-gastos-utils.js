(function (root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CalendarGastos = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function buildMonthGrid(monthKey, rows) {
    const [year, month] = String(monthKey).split('-').map(Number);
    if (!Number.isInteger(year) || month < 1 || month > 12) {
      throw new Error('Mês inválido');
    }

    const daysInMonth = new Date(year, month, 0).getDate();
    const totals = new Map();

    (rows || []).forEach(({ date, value }) => {
      if (!String(date).startsWith(monthKey)) return;
      totals.set(date, (totals.get(date) || 0) + Math.abs(Number(value) || 0));
    });

    const days = Array(new Date(year, month - 1, 1).getDay()).fill(null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = `${monthKey}-${String(day).padStart(2, '0')}`;
      days.push({ day, date, total: totals.get(date) || 0, intensity: 0 });
    }
    while (days.length % 7) days.push(null);

    const entries = days.filter(Boolean);
    const maxDaily = Math.max(0, ...entries.map(day => day.total));
    entries.forEach(day => {
      day.intensity = maxDaily ? day.total / maxDaily : 0;
    });

    return {
      year,
      monthIndex: month - 1,
      days,
      total: entries.reduce((sum, day) => sum + day.total, 0),
      spendingDays: entries.filter(day => day.total > 0).length,
      maxDaily,
    };
  }

  function selectRows(rows, { includeTransfers = false, profileId = '' } = {}) {
    return (rows || []).filter(row =>
      (includeTransfers || !row.transfer) &&
      (!profileId || String(row.profileId) === String(profileId))
    );
  }

  return { buildMonthGrid, selectRows };
});
