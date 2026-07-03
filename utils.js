/* ════════════════════════════════════════════════════════════
   utils.js  —  Funções auxiliares globais
   Usado por: config.js, transacoes.js, app.js
════════════════════════════════════════════════════════════ */

/* ── GERA ID ÚNICO ── */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ── ESCAPA HTML (evita XSS) ── */
function escHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── FORMATA DATA ISO → DD/MM/AAAA ── */
function fmtDateStr(str) {
  if (!str) return '—';
  const [y, m, d] = str.split('-');
  if (!y || !m || !d) return str;
  return `${d}/${m}/${y}`;
}

/* ── FORMATA DATA ISO COMPLETA ── */
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

/* ── FORMATA VALOR MONETÁRIO ── */
function fmtValor(n) {
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/* ── MÁSCARA DE VALOR (campo de input) ── */
function maskValor(el) {
  let v = el.value.replace(/\D/g, '');
  if (!v) { el.value = ''; return; }
  v = (parseInt(v) / 100).toFixed(2);
  el.value = parseFloat(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

/* ── TOAST (notificação flutuante) ── */
function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type !== 'success' ? type : ''}`;
  el.innerHTML = `<span>${type === 'success' ? '✓' : type === 'error' ? '✕' : '⚠'}</span> ${msg}`;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

/* ── MODAL DE CONFIRMAÇÃO ── */
let _confirmCb = null;

function openConfirm(msg, callback) {
  document.getElementById('confirmMsg').textContent = msg;
  _confirmCb = callback;
  document.getElementById('confirmOverlay').classList.add('open');
}

function closeConfirm() {
  document.getElementById('confirmOverlay').classList.remove('open');
  _confirmCb = null;
}

document.getElementById('confirmOkBtn').onclick = () => {
  if (_confirmCb) _confirmCb();
  closeConfirm();
};

/* ── COLUNAS REDIMENSIONÁVEIS ── */
function initResizable(thead) {
  thead.querySelectorAll('.resize-handle').forEach(handle => {
    let startX, startW, th;

    handle.onmousedown = (e) => {
      e.stopPropagation();
      th = handle.parentElement;
      startX = e.pageX;
      startW = th.offsetWidth;
      handle.classList.add('dragging');

      document.onmousemove = (e) => {
        const newW = Math.max(60, startW + e.pageX - startX);
        th.style.minWidth = newW + 'px';
        th.style.width    = newW + 'px';
      };

      document.onmouseup = () => {
        handle.classList.remove('dragging');
        document.onmousemove = null;
        document.onmouseup   = null;
      };
    };
  });
}
