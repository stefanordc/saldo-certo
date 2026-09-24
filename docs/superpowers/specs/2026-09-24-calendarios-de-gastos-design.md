# Calendários de Gastos e Conta Padrão

## Objetivo

Adicionar aos Relatórios a aba **Calendários de Gastos**, inspirada no layout de calendário diário fornecido pelo usuário e integrada à identidade visual existente do Saldo Certo. A aba deve exibir os gastos de cada dia do mês, sem transferências por padrão, e permitir incluí-las explicitamente.

Também deve permitir definir uma única conta padrão em Configurações > Contas. Essa conta será sugerida como origem quando o usuário criar uma nova transferência.

## Escopo de interface

### Calendários de Gastos

- Criar uma nova aba em Relatórios, preservando as abas existentes.
- Usar o mês de referência atual por padrão, com os mesmos controles de navegação de mês já usados nos relatórios.
- Exibir um cabeçalho com o mês, o total gasto e a quantidade de dias que tiveram saída.
- Renderizar uma grade de domingo a sábado. Cada célula representa um dia do mês e mostra o número do dia e o total gasto, ou um traço quando não houver gasto.
- Aplicar intensidade de cor proporcional ao gasto diário, partindo das variáveis de cor atuais do tema. A visualização deve funcionar em tema claro e escuro e não copiar a cor rosa da referência.
- Disponibilizar o filtro **Tipo de despesa**, alimentado pelos registros de `perfis`. O valor inicial é todos os perfis.
- Disponibilizar o checkbox **Incluir transferências**, inicialmente desmarcado.

O cálculo considera somente lançamentos de saída que passam pelas regras atuais de cálculo do relatório. Transferências são identificadas pelos helpers já existentes para esse tipo de lançamento, não por comparação frágil de texto. Quando o checkbox estiver marcado, transferências de saída também entram na soma diária, no total e na contagem de dias.

### Conta padrão

- Na tabela de Configurações > Contas, adicionar a coluna **Conta padrão** com um checkbox por linha.
- A ação de marcar uma conta a torna padrão e desmarca qualquer outra conta existente. Desmarcar a conta atual deixa o usuário sem conta padrão.
- Ao abrir uma movimentação nova, a conta não será alterada inicialmente. Quando o usuário selecionar a categoria de transferência, a conta padrão será aplicada como origem se o campo de conta ainda estiver vazio; uma escolha manual do usuário nunca será sobrescrita.
- Edições de transações e transferências existentes preservam as contas gravadas.

## Dados e persistência

- Adicionar `padrao boolean not null default false` à tabela de contas (`cartoes`).
- Garantir no banco, por usuário, que no máximo uma conta esteja marcada como padrão usando índice parcial único. A migração deve contemplar a coluna `user_id` já usada pelo aplicativo.
- Atualizar o schema versionado e criar uma migração aplicável no Supabase. A interface deverá atualizar a conta escolhida e limpar a marcação das demais contas do mesmo usuário.
- Manter a atualização otimista do cache local e recuperar o estado remoto no próximo sync.

## Arquitetura de implementação

O projeto é um aplicativo HTML de arquivo único, e `index.html` é a fonte de execução. A implementação permanecerá nele para seguir a arquitetura atual:

1. Marcação da nova aba, seus filtros e área do calendário na página de Relatórios.
2. Estilos específicos do calendário, usando tokens CSS existentes e regras de tema escuro.
3. Funções puras para filtrar saídas, agrupar por data, calcular intensidade e montar a grade mensal.
4. Registro da nova aba no roteador de relatórios, para manter filtros e redraw corretos.
5. Renderização da coluna de conta padrão e função de alternância exclusiva nas configurações.
6. Aplicação da conta padrão no fluxo de nova transferência, apenas após a categoria de transferência ser selecionada.

## Falhas e casos de borda

- Sem transações: total `R$ 0,00`, zero dias com saída e todos os dias exibidos sem valor.
- Meses com 28 a 31 dias e início em qualquer dia da semana recebem células vazias de alinhamento.
- Lançamentos sem perfil aparecem quando o filtro estiver em todos; não aparecem com um perfil específico selecionado.
- Uma conta excluída não pode continuar marcada como padrão; a migração e a limpeza local removem referências inválidas.
- Caso não haja conta padrão, a criação de transferência continua exigindo que o usuário escolha a conta.

## Verificação

- Testar a agregação diária e a exclusão/inclusão de transferências com casos de meses, perfis e dias sem gasto.
- Testar a exclusividade da conta padrão e a pré-seleção de origem em nova transferência, incluindo a preservação de escolhas manuais e de edições.
- Validar a migração com consulta no Supabase e conferir que RLS/políticas existentes continuam protegendo dados por usuário.
- Abrir a aplicação por servidor local e validar os dois temas, o calendário responsivo e os fluxos de configuração e transferência.
