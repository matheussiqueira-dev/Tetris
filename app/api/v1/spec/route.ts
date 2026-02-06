/**
 * OpenAPI Specification Route
 * Provides API documentation in OpenAPI 3.0 format.
 */

import { createResponse } from "@/lib/server/api/response-builder";

const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Gesture Tetris API",
    description: "API para gerenciamento de scores do Gesture Tetris Arena - um jogo de Tetris controlado por gestos via webcam.",
    version: "1.0.0",
    contact: {
      name: "Matheus Siqueira",
      url: "https://www.matheussiqueira.dev/"
    },
    license: {
      name: "MIT",
      url: "https://opensource.org/licenses/MIT"
    }
  },
  servers: [
    {
      url: "/api/v1",
      description: "API v1"
    }
  ],
  tags: [
    { name: "Health", description: "Endpoints de monitoramento" },
    { name: "Scores", description: "Gerenciamento de scores" },
    { name: "Stats", description: "Estatisticas e metricas" }
  ],
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Verifica saude do servico",
        description: "Retorna status de saude do servico incluindo uptime e uso de memoria.",
        operationId: "getHealth",
        responses: {
          "200": {
            description: "Servico saudavel",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/HealthResponse" }
              }
            }
          }
        }
      }
    },
    "/scores": {
      get: {
        tags: ["Scores"],
        summary: "Lista scores",
        description: "Retorna lista de scores ordenados por ranking, com filtro opcional por modo de jogo.",
        operationId: "listScores",
        parameters: [
          {
            name: "mode",
            in: "query",
            description: "Filtrar por modo de jogo",
            schema: { type: "string", enum: ["classic", "sprint40", "blitz120"] }
          },
          {
            name: "limit",
            in: "query",
            description: "Numero maximo de resultados",
            schema: { type: "integer", minimum: 1, maximum: 50, default: 10 }
          }
        ],
        responses: {
          "200": {
            description: "Lista de scores",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ScoresListResponse" }
              }
            }
          }
        }
      },
      post: {
        tags: ["Scores"],
        summary: "Submete novo score",
        description: "Registra um novo score no ranking. Sujeito a rate limiting por IP.",
        operationId: "submitScore",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ScoreSubmission" }
            }
          }
        },
        responses: {
          "201": {
            description: "Score registrado com sucesso",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ScoreSubmitResponse" }
              }
            }
          },
          "400": {
            description: "Dados invalidos",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          },
          "429": {
            description: "Rate limit excedido",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          }
        }
      },
      delete: {
        tags: ["Scores"],
        summary: "Limpa todos os scores",
        description: "Remove todos os scores do ranking. Requer token de administrador.",
        operationId: "clearScores",
        security: [{ adminToken: [] }],
        responses: {
          "200": {
            description: "Scores removidos"
          },
          "401": {
            description: "Token invalido ou ausente"
          }
        }
      }
    },
    "/stats": {
      get: {
        tags: ["Stats"],
        summary: "Obtem estatisticas",
        description: "Retorna estatisticas gerais do scoreboard.",
        operationId: "getStats",
        responses: {
          "200": {
            description: "Estatisticas do scoreboard",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/StatsResponse" }
              }
            }
          }
        }
      }
    }
  },
  components: {
    securitySchemes: {
      adminToken: {
        type: "apiKey",
        in: "header",
        name: "X-Admin-Token"
      }
    },
    schemas: {
      HealthResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["healthy", "degraded", "unhealthy"] },
              service: { type: "string" },
              version: { type: "string" },
              timestamp: { type: "string", format: "date-time" },
              uptime: { type: "integer", description: "Segundos desde o inicio" }
            }
          }
        }
      },
      ScoreEntry: {
        type: "object",
        required: ["id", "name", "score", "lines", "level", "mode", "durationMs", "createdAt"],
        properties: {
          id: { type: "string" },
          name: { type: "string", minLength: 2, maxLength: 18 },
          score: { type: "integer", minimum: 0 },
          lines: { type: "integer", minimum: 0 },
          level: { type: "integer", minimum: 1 },
          mode: { type: "string", enum: ["classic", "sprint40", "blitz120"] },
          durationMs: { type: "integer", minimum: 0 },
          createdAt: { type: "string", format: "date-time" }
        }
      },
      ScoreSubmission: {
        type: "object",
        required: ["name", "score", "lines", "level", "mode", "durationMs"],
        properties: {
          name: { type: "string", minLength: 2, maxLength: 18, pattern: "^[a-zA-Z0-9 _.-]+$" },
          score: { type: "integer", minimum: 0, maximum: 9999999 },
          lines: { type: "integer", minimum: 0, maximum: 9999 },
          level: { type: "integer", minimum: 1, maximum: 999 },
          mode: { type: "string", enum: ["classic", "sprint40", "blitz120"] },
          durationMs: { type: "integer", minimum: 0, maximum: 3600000 }
        }
      },
      ScoresListResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: {
            type: "object",
            properties: {
              items: { type: "array", items: { $ref: "#/components/schemas/ScoreEntry" } },
              total: { type: "integer" },
              mode: { type: "string", nullable: true }
            }
          }
        }
      },
      ScoreSubmitResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: {
            type: "object",
            properties: {
              item: { $ref: "#/components/schemas/ScoreEntry" },
              placement: { type: "integer" },
              isHighScore: { type: "boolean" }
            }
          }
        }
      },
      StatsResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: {
            type: "object",
            properties: {
              totalScores: { type: "integer" },
              scoresByMode: {
                type: "object",
                properties: {
                  classic: { type: "integer" },
                  sprint40: { type: "integer" },
                  blitz120: { type: "integer" }
                }
              },
              lastUpdated: { type: "string", format: "date-time", nullable: true }
            }
          }
        }
      },
      ErrorResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", enum: [false] },
          error: {
            type: "object",
            properties: {
              error: { type: "string" },
              code: { type: "string" },
              details: { type: "object", nullable: true },
              requestId: { type: "string" },
              retryAfterMs: { type: "integer", nullable: true }
            }
          }
        }
      },
      ApiMeta: {
        type: "object",
        properties: {
          requestId: { type: "string" },
          timestamp: { type: "string", format: "date-time" },
          durationMs: { type: "integer" }
        }
      }
    }
  }
};

export async function GET(request: Request) {
  const res = createResponse(request);
  return res.success(openApiSpec);
}

export async function OPTIONS(request: Request) {
  return createResponse(request).options();
}
