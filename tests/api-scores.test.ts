import { beforeEach, describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/scores/route";
import { resetScoreRuntimeForTests } from "@/lib/server/scores/store";

interface ScoreEntry {
  id: string;
  name: string;
  score: number;
  lines: number;
  level: number;
  mode: string;
  durationMs: number;
  createdAt: string;
}

interface SuccessResponse<T> {
  success: true;
  data: T;
  meta: { requestId: string };
}

interface ErrorResponse {
  success: false;
  error: { error: string; code: string };
  meta: { requestId: string };
}

describe("Scores API", () => {
  beforeEach(() => {
    resetScoreRuntimeForTests();
  });

  it("retorna 400 para payload invalido", async () => {
    const request = new Request("http://localhost/api/scores", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "10.1.1.1"
      },
      body: JSON.stringify({
        name: "a",
        score: -2,
        lines: 0,
        level: 1,
        mode: "classic",
        durationMs: 5000
      })
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const json = (await response.json()) as ErrorResponse;
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("salva score valido e calcula colocacao", async () => {
    const first = await POST(
      new Request("http://localhost/api/scores", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "10.1.1.2"
        },
        body: JSON.stringify({
          name: "Matheus",
          score: 3300,
          lines: 20,
          level: 5,
          mode: "classic",
          durationMs: 62000
        })
      })
    );
    const firstJson = (await first.json()) as SuccessResponse<{ placement: number }>;
    expect(first.status).toBe(201);
    expect(firstJson.success).toBe(true);
    expect(firstJson.data.placement).toBe(1);

    const second = await POST(
      new Request("http://localhost/api/scores", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "10.1.1.3"
        },
        body: JSON.stringify({
          name: "Rival",
          score: 1200,
          lines: 11,
          level: 3,
          mode: "classic",
          durationMs: 45000
        })
      })
    );
    const secondJson = (await second.json()) as SuccessResponse<{ placement: number }>;
    expect(second.status).toBe(201);
    expect(secondJson.data.placement).toBe(2);
  });

  it("retorna itens filtrados por modo", async () => {
    await POST(
      new Request("http://localhost/api/scores", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "10.1.1.4"
        },
        body: JSON.stringify({
          name: "Classic",
          score: 800,
          lines: 8,
          level: 2,
          mode: "classic",
          durationMs: 32000
        })
      })
    );
    await POST(
      new Request("http://localhost/api/scores", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "10.1.1.5"
        },
        body: JSON.stringify({
          name: "Blitz",
          score: 4200,
          lines: 29,
          level: 7,
          mode: "blitz120",
          durationMs: 119000
        })
      })
    );

    const response = await GET(new Request("http://localhost/api/scores?mode=blitz120&limit=10"));
    const json = (await response.json()) as SuccessResponse<{ items: ScoreEntry[] }>;

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.items.length).toBe(1);
    expect(json.data.items[0].mode).toBe("blitz120");
  });

  it("aplica rate limit para mesmo IP", async () => {
    let lastStatus = 0;
    for (let i = 0; i < 9; i += 1) {
      const response = await POST(
        new Request("http://localhost/api/scores", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": "10.1.1.9"
          },
          body: JSON.stringify({
            name: `Player${i}`,
            score: i * 10,
            lines: i,
            level: 1,
            mode: "classic",
            durationMs: 1000 + i
          })
        })
      );
      lastStatus = response.status;
    }

    expect(lastStatus).toBe(429);
  });

  it("bloqueia score sprint com menos de 40 linhas", async () => {
    const response = await POST(
      new Request("http://localhost/api/scores", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "10.1.1.10"
        },
        body: JSON.stringify({
          name: "Runner",
          score: 900,
          lines: 33,
          level: 4,
          mode: "sprint40",
          durationMs: 54000
        })
      })
    );

    expect(response.status).toBe(400);
    const json = (await response.json()) as ErrorResponse;
    expect(json.success).toBe(false);
  });

  it("ordena sprint por linhas e tempo", async () => {
    const submit = async (payload: unknown, ip: string) =>
      POST(
        new Request("http://localhost/api/scores", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": ip
          },
          body: JSON.stringify(payload)
        })
      );

    await submit(
      {
        name: "Fast40",
        score: 900,
        lines: 40,
        level: 6,
        mode: "sprint40",
        durationMs: 65000
      },
      "10.1.1.11"
    );
    await submit(
      {
        name: "Slow40",
        score: 1800,
        lines: 40,
        level: 7,
        mode: "sprint40",
        durationMs: 90000
      },
      "10.1.1.12"
    );
    await submit(
      {
        name: "PlusLines",
        score: 100,
        lines: 41,
        level: 7,
        mode: "sprint40",
        durationMs: 120000
      },
      "10.1.1.13"
    );

    const response = await GET(new Request("http://localhost/api/scores?mode=sprint40&limit=10"));
    const json = (await response.json()) as SuccessResponse<{ items: ScoreEntry[] }>;
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.items[0].name).toBe("PlusLines");
    expect(json.data.items[1].name).toBe("Fast40");
    expect(json.data.items[2].name).toBe("Slow40");
  });

  it("inclui request id em respostas", async () => {
    const response = await GET(new Request("http://localhost/api/scores"));
    const json = (await response.json()) as SuccessResponse<unknown>;

    expect(json.meta.requestId).toBeDefined();
    expect(typeof json.meta.requestId).toBe("string");
    expect(response.headers.get("x-request-id")).toBe(json.meta.requestId);
  });
});
