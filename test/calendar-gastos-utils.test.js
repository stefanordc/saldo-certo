const test = require('node:test');
const assert = require('node:assert/strict');
const { buildMonthGrid, selectRows, selectForCalendar } = require('../js/calendar-gastos-utils.js');

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

test('calendar aggregation filters by the selected expense profile', () => {
  const rows = [
    { date: '2026-09-11', value: 30, transfer: false, profileId: 'essencial' },
    { date: '2026-09-12', value: 70, transfer: false, profileId: 'lazer' },
  ];

  const filtered = selectRows(rows, { profileId: 'essencial' });

  assert.deepEqual(filtered, [rows[0]]);
});

test('calendar filter forwards the selected profile to the row selector', () => {
  const rows = [
    { date: '2026-09-11', value: 30, transfer: false, profileId: 'essencial' },
    { date: '2026-09-12', value: 70, transfer: false, profileId: 'lazer' },
  ];

  assert.deepEqual(
    selectForCalendar(rows, { includeTransfers: false, selectedProfileId: 'essencial' }),
    [rows[0]]
  );
});
