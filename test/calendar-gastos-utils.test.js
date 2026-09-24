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
