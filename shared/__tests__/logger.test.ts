import { describe, it, expect } from "vitest";
import pino from "pino";

const STELLAR_KEY_RE = /S[A-Z2-7]{55}/g;

function sanitize(v: unknown): unknown {
  return typeof v === "string" ? v.replace(STELLAR_KEY_RE, "[STELLAR-KEY-REDACTED]") : v;
}

// Build the same logger config used in shared/logger.ts but with captured output
function buildTestLogger() {
  const lines: string[] = [];
  const stream = {
    write(line: string) { lines.push(line); },
  };
  const log = pino(
    {
      level: "trace",
      redact: {
        paths: [
          "authorization",
          "req.headers.authorization",
          "AGENT_SECRET_KEY",
          "LLM_API_KEY",
          "OZ_FACILITATOR_API_KEY",
          "MPP_SECRET_KEY",
          "*.secret",
          "*.apiKey",
        ],
        censor: "[REDACTED]",
      },
      serializers: {
        task: (v: unknown) =>
          typeof v === "string" ? v.slice(0, 80) + "…" : v,
      },
      formatters: {
        log(obj) {
          return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, sanitize(v)]));
        },
      },
    },
    stream as any,
  );
  return { log, lines };
}

describe("logger redaction", () => {
  it("redacts AGENT_SECRET_KEY field", () => {
    const { log, lines } = buildTestLogger();
    log.info({ AGENT_SECRET_KEY: "super-secret-value" }, "test");
    const entry = JSON.parse(lines[0]);
    expect(entry.AGENT_SECRET_KEY).toBe("[REDACTED]");
  });

  it("redacts LLM_API_KEY field", () => {
    const { log, lines } = buildTestLogger();
    log.info({ LLM_API_KEY: "gsk_abc123" }, "test");
    const entry = JSON.parse(lines[0]);
    expect(entry.LLM_API_KEY).toBe("[REDACTED]");
  });

  it("redacts authorization field", () => {
    const { log, lines } = buildTestLogger();
    log.info({ authorization: "Bearer token123" }, "test");
    const entry = JSON.parse(lines[0]);
    expect(entry.authorization).toBe("[REDACTED]");
  });

  it("scrubs Stellar key patterns from string values", () => {
    // Stellar secret keys are exactly 56 chars: S + 55 base32 chars
    const stellarKey = "S" + "A".repeat(55);
    expect(stellarKey).toHaveLength(56);
    expect(stellarKey).toMatch(/S[A-Z2-7]{55}/);
    const { log, lines } = buildTestLogger();
    log.info({ wallet: stellarKey }, "test");
    const entry = JSON.parse(lines[0]);
    expect(entry.wallet).toBe("[STELLAR-KEY-REDACTED]");
  });

  it("scrubs Stellar keys embedded in longer strings", () => {
    const stellarKey = "S" + "A".repeat(55);
    const { log, lines } = buildTestLogger();
    // Use a field name other than 'msg' — pino reserves 'msg' for the message arg
    log.info({ detail: `wallet is ${stellarKey} for agent` }, "test");
    const entry = JSON.parse(lines[0]);
    expect(entry.detail).not.toContain(stellarKey);
    expect(entry.detail).toContain("[STELLAR-KEY-REDACTED]");
  });

  it("truncates task field to 80 chars", () => {
    const longTask = "a".repeat(200);
    const { log, lines } = buildTestLogger();
    log.info({ task: longTask }, "test");
    const entry = JSON.parse(lines[0]);
    expect(entry.task.length).toBeLessThanOrEqual(83); // 80 + "…"
    expect(entry.task).toContain("…");
  });

  it("does not redact unrelated string fields", () => {
    const { log, lines } = buildTestLogger();
    log.info({ drug: "Lisinopril", pharmacy: "Costco" }, "test");
    const entry = JSON.parse(lines[0]);
    expect(entry.drug).toBe("Lisinopril");
    expect(entry.pharmacy).toBe("Costco");
  });
});
