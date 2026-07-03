/* ════════════════════════════════════════════════════════════
   app.js  —  Ponto de entrada da aplicação
   Responsabilidade: navegação entre páginas e inicialização.
   Este é o ÚLTIMO script carregado no index.html.
════════════════════════════════════════════════════════════ */

/* ────────────────────────────────────────────
   NAVEGAÇÃO ENTRE PÁGINAS
──────────────────────────────────────────── */
function showPage(id) {
  // Esconde todas as páginas
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  // Mostra a página escolhida
  document.getElementById('page-' + id).classList.add('active');

  // Atualiza botões do menu
  const botoes = document.querySelectorAll('nav button');
  botoes[0].classList.toggle('active', id === 'transacoes');
  botoes[1].classList.toggle('active', id === 'configuracoes');

  // Ação ao entrar em cada página
  if (id === 'transacoes') {
    renderTransacoes();
  }

  if (id === 'configuracoes') {
    renderizarAba('cartoes');
  }
}

/* ────────────────────────────────────────────
   FECHA MODAIS AO CLICAR FORA DELES
──────────────────────────────────────────── */
document.getElementById('transModal').addEventListener('click', function (e) {
  if (e.target === this) closeTransModal();
});

document.getElementById('editConfigModal').addEventListener('click', function (e) {
  if (e.target === this) closeEditConfig();
});

document.getElementById('confirmOverlay').addEventListener('click', function (e) {
  if (e.target === this) closeConfirm();
});

/* ────────────────────────────────────────────
   INICIALIZAÇÃO
   (roda quando o HTML termina de carregar)
──────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  renderTransacoes(); // página inicial já carregada
});
