# Temas

A aparência tem duas partes: o **modo** (`system`, `light` ou `dark`) e um **tema** escolhido à
parte para cada modo. O tema claro vale enquanto o aplicativo está claro e o escuro enquanto está
escuro; alguns temas só existem em um dos modos. Toda mudança é salva na conta na hora, em Ajustes >
Preferências, no menu de tema do cabeçalho ou na busca (Ctrl K).

## Como o tema chega à tela

| Etapa | Onde |
| --- | --- |
| Lista de temas válidos por modo | `lightPalettes` e `darkPalettes` em `packages/domain/src/preferences.ts` |
| Contrato da API (`lightPalette`, `darkPalette`) | `packages/validators/src/preferences.ts` |
| Colunas `light_palette` e `dark_palette` | `user_preferences`, como `text` com padrão `openmonetis` |
| Cores de cada tema | `apps/web/src/styles/palettes/<família>.css`, importado em `palettes.css` |
| Aplicação na página | `apps/web/src/components/theme-provider.tsx` |
| Nomes exibidos | `apps/web/src/features/preferences/preferences.presentation.ts` |

As colunas são texto, não enum do PostgreSQL: o domínio é a única lista. Adicionar ou retirar um
tema não exige migration, e um tema retirado que ainda esteja salvo volta ao padrão `openmonetis`
na leitura (`normalizeUserPreferences`). A API recusa com 400 um tema fora da lista do seu modo.

No navegador, a página raiz recebe a classe do modo e `data-palette="<tema>-<modo>"`, por exemplo
`nord-dark`. Um script em linha aplica o último tema guardado no `localStorage` antes da primeira
pintura, sem piscar o tema padrão; em seguida, o tema salvo na conta prevalece. Se um salvamento
falhar, a página volta ao tema salvo e mostra um aviso.

## Adicionar um tema

1. **Domínio.** Inclua o identificador em camelCase em `lightPalettes`, `darkPalettes` ou nos dois,
   perto dos temas da mesma família.
2. **Cores.** Crie ou edite `apps/web/src/styles/palettes/<família>.css` (kebab-case) e importe o
   arquivo em `palettes.css`. Cada tema declara suas próprias cores no escopo
   `[data-palette="<tema>-<modo>"]`. Os tokens derivados (material, destaque, foco) vêm de
   `palettes/openmonetis.css` e não precisam ser repetidos.
3. **Menus de um tema claro.** Menus e listas abertas usam sempre as cores escuras. Um tema claro
   também declara `[data-palette="<tema>-light"] .dark`, normalmente no mesmo bloco da versão
   escura da família.
4. **Cor da barra do navegador.** Adicione o fundo do tema a `browserThemeColors` em
   `theme-provider.tsx`; o TypeScript aponta a ausência.
5. **Nome.** Preencha `paletteLabels` com o nome da família e `lightPaletteVariantLabels` ou
   `darkPaletteVariantLabels` com a variante (`"Padrão"` quando a família tem uma só por modo). O
   seletor agrupa automaticamente famílias com mais de uma variante.
6. **Fonte ou cantos.** Um tema que troca a fonte faz isso em `apps/web/src/styles/fonts.css`; um
   que muda os cantos define `--radius` no próprio arquivo.
7. **Changelog.** Registre o tema em `Unreleased` e atualize a contagem de valores de
   `darkPalette` ou `lightPalette` citada na entrada da API.

Retirar um tema é o caminho inverso: remova o identificador, as cores e os nomes. Contas que o
usavam voltam ao padrão sem migration.

### Tokens obrigatórios

Cada escopo declara `--background`, `--foreground`, `--card`, `--popover`, `--primary`,
`--primary-foreground`, `--secondary`, `--muted`, `--muted-foreground`, `--destructive`,
`--success`, `--warning`, `--info`, `--teal`, `--brand`, `--brand-strong`, `--brand-foreground`,
`--border` e `--chart-1` a `--chart-5`. As versões escuras declaram também `--popover-field`, o
fundo das listas abertas dentro de formulários. Receitas continuam verdes e despesas vermelhas em
todo tema, exceto nos monocromáticos e nos feitos para daltonismo; muda só o tom.

## Contraste

Todo tema precisa manter, medido como no WCAG 2.2:

- **4,5:1** para texto: `foreground`, `muted-foreground`, `brand-strong` e as cores de estado
  (`success`, `destructive`, `warning`, `info`, `teal`) sobre o fundo e sobre os cards; o texto
  de `primary` e `brand` sobre eles; e o texto dos menus sobre `popover`;
- **3:1** para as séries de gráfico (`chart-1` a `chart-5`) sobre os cards.

Cores que o tema original reserva para destaques de terminal costumam precisar de ajuste para virar
texto. Prefira `color-mix(in oklch, <cor> N%, <foreground>)` a uma cor nova, para manter o tom da
paleta. Exceções ficam em `exceptions`, no teste de contraste, sempre com o motivo; hoje só a
primeira série do OpenMonetis claro, o coral da marca.

## Verificação

| Teste | O que garante |
| --- | --- |
| `apps/web/src/styles/palettes.test.ts` (`pnpm test`) | Todo tema do domínio tem seu escopo CSS com os tokens obrigatórios, todo arquivo está importado e nenhum CSS pinta um tema inexistente. |
| `apps/web/e2e/palette-contrast.spec.ts` (`pnpm test:e2e`) | As regras de contraste acima, para todos os temas, com as cores resolvidas pelo navegador. |
| `apps/web/e2e/appearance.spec.ts` (`pnpm test:e2e`) | Salvamento na conta, tema aplicado desde a primeira pintura, volta ao tema salvo após falha e troca de modo pela busca. |
| `apps/api/src/services/preferences.service.test.ts` | Tema inválido para o modo é recusado e tema retirado volta ao padrão. |
