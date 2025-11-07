## Documentação do Pipeline de Tokens

### Visão Geral
- A automação usa `Style Dictionary` para transformar o `tokens.json` exportado do plugin Design Tokens (Figma) em:
  - `build/css/tokens-css-formatted.css`: apenas variáveis de cor, com nomes sem prefixos de categorias repetidas.
  - `build/js/tokens-utilities.js`: objeto `tokensUtilities` com utilitários Tailwind para tipografia e grids.
- A configuração vive em `style-dictionary.config.cjs`, onde registramos dois formatters customizados (`custom/css-variables` e `custom/tailwind-utilities`).

### Passo a Passo Interno
1. **Filtragem de cores**
   - O formatter `custom/css-variables` seleciona apenas tokens cuja categoria ou tipo seja `color`.
   - Cada token vira `--nome-sanitizado: valor;`, removendo apenas os prefixos `primitives-default-` e `semantic-colors-`.
   - Referências a outros tokens são resolvidas como `var(--token-sanitizado)`.

2. **Geração das utilidades Tailwind**
   - O formatter `custom/tailwind-utilities` filtra tokens de fonte (`custom-fontStyle`) e grid (`custom-grid`).
   - Fontes: converte `fontSize` para `rem` (dividindo por 16), `letterSpacing` para `px`, mantém `fontFamily` e `fontWeight`.
   - Grids: traduz `pattern`, `count`, `gutterSize`, `offset`, `alignment` em propriedades `display`, `gridTemplate*`, `columnGap/rowGap`, `paddingInline`, `alignItems/justifyItems`.
   - Classes são kebab-case (`.font-default-h1`, `.grid-lg`), e o arquivo exporta `export const tokensUtilities = {...}`.

3. **Execução**
   - `npm run build` chama `style-dictionary build --config ./style-dictionary.config.cjs`.
   - Os dois arquivos são reescritos a cada execução.

### Complexidade de Fazer Manualmente
- **Sem automação**:
  - Copiar centenas de tokens, aplicar transformações numéricas (px→rem) e manter nomes consistentes.
  - Garantir que referências semânticas apontem para primitivas corretas.
  - Ajustar formatação Tailwind (kebab-case, objetos JS válidos).
  - Trabalho propenso a erros, alto esforço sempre que o Figma muda.
- **Com automação**:
  - Mudanças de tokens exigem apenas exportar novo `tokens.json` e rodar `npm run build`.
  - Formatação e consistência garantidas por código versionado.
  - Tempo de atualização cai de horas para minutos, reduzindo retrabalho.

### Riscos e Cuidados
- **Mudança de prefixos no Figma**: se o plugin Design Tokens alterar nomes (ex.: deixar de usar `semantic-colors-` ou `primitives-default-`), nosso strip atual pode não encontrar os prefixos, gerando nomes com partes indesejadas ou colidindo. Recomenda-se validar o CSS gerado após atualizações.
- **Colisões de nomes**: remover prefixos diferentes que compartilham o mesmo sufixo pode sobrescrever variáveis (ex.: duas `--brand-primary`). Ajuste os prefixos/nomes caso precise manter valores distintos.
- **Novos tipos de token**: se surgir outro tipo (ex.: gradientes) que precise de utilidades JS ou CSS específicas, será necessário estender os formatters.

### Fluxo Diário de Trabalho
1. **Atualizar tokens no Figma** usando o plugin **Design Tokens**.
2. **Exportar** o bundle em JSON pelo plugin e substituir o arquivo `input/tokens.json` deste projeto.
3. **Rodar `npm run build`** para gerar `tokens-css-formatted.css` e `tokens-utilities.js`.
4. **Validar os arquivos gerados**:
   - Conferir se variáveis CSS e utilidades Tailwind cobrem as mudanças esperadas.
   - Observar se houve colisão de nomes ou formatos inesperados.
5. **Copiar ou importar** os arquivos para o app alvo:
   - `tokens-css-formatted.css` pode ser aplicado globalmente (ex.: importado no entrypoint).
   - `tokens-utilities.js` pode ser consumido por um plugin Tailwind (`addUtilities(tokensUtilities)`).
6. **Versionar e enviar** as atualizações no repositório do app.
7. **Repetir** sempre que houver mudanças no Figma.

Esse processo garante alinhamento entre design e implementação sem uma biblioteca completa de design system, mantendo os artefatos prontos para os diversos projetos que consomem os tokens.