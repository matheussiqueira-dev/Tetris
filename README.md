# Gesture Tetris Arena

Aplicação web de Tetris controlado por gestos da mão via webcam, com detecção em tempo real usando OpenCV.js, frontend em Next.js e API versionada de leaderboard.

## Visão Geral

O projeto combina:

- Gameplay clássico de Tetris (engine determinística, colisão, rotação, linhas, nível e score).
- Input natural por visão computacional (movimento lateral, rotação do pulso e hard drop por gesto descendente rápido).
- Interface moderna com feedback visual contínuo, acessível em desktop e mobile.
- Backend HTTP para ranking com validação, rate limiting, logs estruturados e camada de serviço desacoplada.

Público-alvo:

- Pessoas que buscam experiências interativas com webcam.
- Demonstrações de visão computacional aplicada a jogos.
- Base para evolução de produto gamificado com ranking e modos de jogo.

## Arquitetura e Decisões Técnicas

### Camadas

- `lib/tetris/*` (Domínio): regras de jogo puras, sem dependência de UI.
- `lib/vision/*` (Infra CV): carga do OpenCV.js e detector de gestos.
- `components/GestureTetris.tsx` (Apresentação + Orquestração): loop, render, eventos, UX.
- `app/api/*` (Backend/API): endpoints de saúde, ranking e versão `v1`.
- `lib/server/*` (Aplicação backend): validação, segurança, persistência em memória e serviços de domínio.
- `lib/shared/*` (Contrato compartilhado): modos de jogo entre frontend e backend.
- `hooks/*` (Estado UX): persistência de preferências em `localStorage`.

### Princípios Aplicados

- Separação de responsabilidades: engine, sessão de jogo, detecção de gestos, render e API desacoplados.
- DRY: constantes e contratos compartilhados de modo de jogo.
- Escalabilidade: repositório de placar abstrato (`ScoreRepository`) pronto para troca por banco real.
- Segurança e robustez: validação com Zod, sanitização de nome, rate limiting por IP, headers de segurança e rota administrativa protegida por token.
- Contrato evolutivo: endpoints `v1` e especificação mínima em `/api/v1/spec`.

### SEO e Rastreamento

- Nenhuma estrutura de indexação/rastreamento existente foi removida.
- Metadados SEO foram preservados e enriquecidos no `app/layout.tsx`.
- Não há alteração de comportamento em tags/scripts de analytics/pixel.

## Stack e Tecnologias

- Next.js 15 (App Router)
- React 19 + TypeScript
- OpenCV.js (processamento de imagem no browser)
- Canvas 2D (renderização do jogo e overlay de visão)
- Zod (validação de API)
- Vitest (testes unitários e de integração leve)

## Estrutura do Projeto

```txt
app/
  api/
    health/route.ts
    scores/route.ts
    v1/
      health/route.ts
      scores/route.ts
      spec/route.ts
  globals.css
  layout.tsx
  page.tsx
  robots.ts
  sitemap.ts
components/
  GestureTetris.tsx
hooks/
  use-persistent-state.ts
lib/
  client/
    scoreboard-api.ts
  server/
    logger.ts
    security/
      ip.ts
      rate-limiter.ts
    scores/
      repository.ts
      service.ts
      sort.ts
      store.ts
      types.ts
    validation/
      score-schema.ts
  shared/
    game-mode.ts
  tetris/
    engine.ts
    render.ts
    session.ts
    pieces.ts
    types.ts
  vision/
    gesture-detector.ts
    opencv-loader.ts
tests/
  api-scores.test.ts
  scores-sort.test.ts
  tetris-engine.test.ts
  tetris-session.test.ts
```

## Funcionalidades Implementadas

- Modo `Classic`, `Sprint 40` e `Blitz 120`.
- `Hold` de peça (tecla `C` ou botão).
- Pausa/continuação (`P`) e reset rápido (`R`).
- Ajuste de sensibilidade dos gestos em tempo real.
- Feedback de detecção (confiabilidade, área, velocidade e ângulo).
- Leaderboard com envio e leitura por modo.
- Persistência local de modo, sensibilidade e nome do jogador.
- Timeline de gestos reconhecidos para auditoria visual de input.

## API

### `GET /api/health` e `GET /api/v1/health`

Retorna status da aplicação.

### `GET /api/scores?mode=<mode>&limit=<n>` e `GET /api/v1/scores?mode=<mode>&limit=<n>`

Retorna ranking filtrado por modo.

- `mode`: `classic | sprint40 | blitz120` (opcional)
- `limit`: 1 a 50 (opcional)

### `POST /api/scores` e `POST /api/v1/scores`

Envia um score validado.

Body:

```json
{
  "name": "Player",
  "score": 3200,
  "lines": 21,
  "level": 5,
  "mode": "classic",
  "durationMs": 62000
}
```

### `DELETE /api/scores`

Limpa ranking (uso administrativo).

- Requer header `x-admin-token` igual a `SCOREBOARD_ADMIN_TOKEN`.

### `GET /api/v1/spec`

Retorna especificação simplificada dos endpoints públicos.

## Segurança e Qualidade

- Validação estrita de payload com Zod.
- Sanitização e limites de entrada.
- Rate limiting para submissão de score.
- Regras de consistência por modo (`sprint40` exige mínimo de linhas; `blitz120` limita duração).
- Logs estruturados no backend.
- Testes automatizados para domínio, ordenação de ranking e API.

## Instalação e Execução

```bash
npm install
npm run dev
```

Aplicação local: `http://localhost:3000`

## Testes, Lint e Build

```bash
npm run test
npm run lint
npm run build
```

## Deploy

- Compatível com Vercel e qualquer ambiente Node com suporte a Next.js.
- Para limpeza administrativa do ranking, configure:

```bash
SCOREBOARD_ADMIN_TOKEN=seu_token_forte
```

## Boas Práticas Adotadas

- Renderização em canvas com atualização desacoplada do estado React.
- Amostragem de detecção de gestos em frequência controlada para melhor FPS.
- Reuso de `Mat` no OpenCV para reduzir custo de alocação.
- Fallbacks de teclado para acessibilidade e usabilidade.
- Layout responsivo e respeito a `prefers-reduced-motion`.

## Melhorias Futuras

- Persistência do ranking em banco (PostgreSQL/Redis) com cache distribuído.
- Telemetria com tracing e métricas (OpenTelemetry).
- Calibração assistida por iluminação e tom de pele.
- Replays/sessões com histórico de inputs.
- E2E browser tests com Playwright.

Autoria: Matheus Siqueira  
Website: https://www.matheussiqueira.dev/
