import { beforeEach, describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/scores/route";
import { resetScoreRuntimeForTests } from "@/lib/server/scores/store";

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
    const firstJson = (await first.json()) as { placement: number };
    expect(first.status).toBe(201);
    expect(firstJson.placement).toBe(1);

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
    const secondJson = (await second.json()) as { placement: number };
    expect(second.status).toBe(201);
    expect(secondJson.placement).toBe(2);
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
    const json = (await response.json()) as { items: Array<{ mode: string }> };

    expect(response.status).toBe(200);
    expect(json.items.length).toBe(1);
    expect(json.items[0].mode).toBe("blitz120");
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
});
