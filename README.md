# Tetris Gesture Control Deck

Aplicacao web de Tetris com controle por gestos via webcam, renderizacao em canvas e backend HTTP para leaderboard.

## 1. Visao Geral do Frontend

### Proposito do produto
- Oferecer uma experiencia de gameplay baseada em visao computacional no navegador.
- Manter fallback completo por teclado para acessibilidade e robustez operacional.
- Entregar telemetria de runtime (FPS, confianca de gesto, estado da camera/OpenCV) em tempo real.

### Publico-alvo
- Pessoas interessadas em jogos experimentais com webcam.
- Desenvolvedores que estudam OpenCV.js + Next.js em uma base real.
- Times que precisam de uma base para evolucao de produto gamificado com ranking.

### Fluxos principais de usuario
- Escolher modo de jogo (`Classic`, `Sprint 40`, `Blitz 120`).
- Jogar por gesto, por teclado, ou modo hibrido.
- Ajustar sensibilidade e preset de visao.
- Encerrar partida, enviar score e acompanhar leaderboard por modo.

## 2. Analise Tecnica e Diagnostico

### Diagnostico encontrado
- Componente principal muito concentrado em uma unica unidade, dificultando manutencao.
- Alto acoplamento entre loop de jogo, deteccao de gestos e camada de UI.
- Falta de controles operacionais para balancear CPU x precisao da visao.
- UX boa, mas com oportunidade de maior clareza hierarquica e consistencia visual.

### Intervencoes aplicadas no refactor
- Extraidas configuracoes e utilitarios para `components/tetris/config.ts` e `components/tetris/utils.ts`.
- Reescrito `components/GestureTetris.tsx` com organizacao por blocos de responsabilidade.
- Redesenho completo da interface com design tokens e componentes de painel consistentes.
- Melhorias de runtime para reduzir trabalho por frame e evitar atualizacoes reativas desnecessarias.

## 3. Arquitetura Frontend Atual

### Camadas
- `app/*`: App Router, metadata SEO, pagina raiz e estilos globais.
- `components/GestureTetris.tsx`: orquestracao da experiencia de jogo e paineis de UI.
- `components/tetris/*`: contratos/configuracoes e utilitarios de renderizacao/calculo.
- `hooks/use-persistent-state.ts`: persistencia de preferencias no `localStorage`.
- `lib/tetris/*`: motor do jogo (dominio puro, sem dependencia de React).
- `lib/vision/*`: carga do OpenCV.js e deteccao de gestos.
- `lib/client/*`: cliente HTTP do leaderboard.

### Organizacao de estado
- Estado de alta frequencia (frame loop) controlado com `refs` para reduzir rerender.
- Estado de UI controlado por `useState` com atualizacao em janelas temporais.
- Preferencias do usuario persistidas (`modo`, `sensibilidade`, `preset`, `input mode`, `alto contraste`).

## 4. UI/UX Refactor (Nivel Senior)

### Design system e consistencia
- Novo conjunto de tokens visuais (cores, superficies, bordas, raios, sombras, estados).
- Tipografia intencional com contraste entre corpo e titulo.
- Hierarquia visual por cards/paineis com semantica consistente.
- Modo de alto contraste para melhor legibilidade em diferentes condicoes.

### Acessibilidade e usabilidade
- `aria-live` para feedback de runtime e eventos de partida.
- Estados de foco visiveis e padronizados.
- Fallback de teclado preservado para operacao sem camera.
- Layout responsivo para desktop, tablet e mobile.
- Respeito a `prefers-reduced-motion`.

### Navegacao e interacao
- Header com contexto de sessao e configuracoes primarias.
- Coluna de jogo separada de coluna de operacao (camera, controles, ranking, timeline).
- Painel de insights para leitura rapida de desempenho da sessao.

## 5. Novas Features Implementadas

1. Perfis de input (`Hibrido`, `Somente gesto`, `Somente teclado`)
- Impacto: melhora acessibilidade e controle operacional.
- Justificativa tecnica: desacopla entrada de dados, reduz risco de conflito de comandos e permite economia de CPU no modo teclado.

2. Presets de visao (`Eco 240p`, `Balanceado 320p`, `Precisao 400p`)
- Impacto: adapta desempenho conforme hardware do usuario.
- Justificativa tecnica: altera resolucao de processamento e intervalo de amostragem do detector, controlando custo computacional.

3. Auto-pausa ao trocar aba (configuravel)
- Impacto: evita perdas involuntarias de partida.
- Justificativa tecnica: usa `visibilitychange` para proteger estado de sessao quando a janela perde foco.

4. Session Insights (gestos totais, confianca media, APM, saude de FPS)
- Impacto: aumenta compreensao da performance da sessao.
- Justificativa tecnica: agrega telemetria em tempo real para apoiar ajuste fino de sensibilidade e preset.

5. Auto-calibracao de sensibilidade
- Impacto: reduz tentativa-e-erro de configuracao manual.
- Justificativa tecnica: estima ajuste com base na confianca media observada durante a sessao.

## 6. SEO, Performance e Escalabilidade

### SEO
- Metadata enriquecida em `app/layout.tsx`:
  - `title` com template
  - `description`, `keywords`, `canonical`
  - Open Graph e Twitter card
  - `authors`, `creator`, `publisher`, `robots`
- Mantidos `robots.ts` e `sitemap.ts`.

### Performance
- Reuso de contextos de canvas para evitar overhead por frame.
- Detecao de gesto com frequencia configuravel por preset.
- Atualizacao do HUD em janela temporal (nao a cada frame).
- Pipeline OpenCV reconfiguravel sem reescrever o restante do loop.

### Escalabilidade
- Contratos de modo de jogo centralizados em `lib/shared/game-mode.ts`.
- API versionada (`/api/v1/*`) preservada.
- Camadas backend desacopladas para evoluir repositorio de score para persistencia real.

## 7. Estrutura do Projeto

```txt
app/
  globals.css
  layout.tsx
  page.tsx
  robots.ts
  sitemap.ts
  api/
    ...
components/
  GestureTetris.tsx
  tetris/
    config.ts
    utils.ts
hooks/
  use-persistent-state.ts
lib/
  client/
    scoreboard-api.ts
  shared/
    game-mode.ts
  tetris/
    engine.ts
    render.ts
    session.ts
  vision/
    gesture-detector.ts
    opencv-loader.ts
tests/
  api-scores.test.ts
  scores-sort.test.ts
  tetris-engine.test.ts
  tetris-session.test.ts
```

## 8. Stack e Tecnologias

- Next.js 15 (App Router)
- React 19 + TypeScript
- OpenCV.js (deteccao de gestos no browser)
- Canvas 2D (tabuleiro + feed de visao)
- Zod (validacao de API)
- Vitest (testes automatizados)

## 9. Setup, Scripts e Build

### Requisitos
- Node.js 20+
- npm 10+

### Instalacao

```bash
npm install
```

### Desenvolvimento

```bash
npm run dev
```

Aplicacao local: `http://localhost:3000`

### Scripts principais

```bash
npm run test
npm run lint
npm run build
npm run start
```

## 10. Boas Praticas Adotadas

- Separacao entre dominio (engine), visao (OpenCV) e apresentacao (React/UI).
- Persistencia de preferencias do usuario sem quebrar experiencia offline.
- Estrategia de fallback para entrada por teclado.
- Estados e feedbacks claros para falhas de camera/runtime.
- Design responsivo sem dependencias externas de UI framework.

## 11. Melhorias Futuras

- Persistir leaderboard em banco (PostgreSQL/Redis) com cache.
- Telemetria de producao com traces e metricas por sessao.
- Tutorial guiado de calibracao de gesto para primeira execucao.
- E2E tests de fluxo completo com Playwright.
- Opcao de internacionalizacao (pt-BR/en-US) com dicionario centralizado.

Autoria: Matheus Siqueira  
Website: https://www.matheussiqueira.dev/
