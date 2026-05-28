import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { applySecurityMiddleware } from "../security-middleware.ts";

function buildApp() {
  const app = express();
  applySecurityMiddleware(app);
  app.get("/", (_req, res) => res.json({ ok: true }));
  app.options("/agent/run", (_req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
    res.setHeader("Access-Control-Allow-Methods", "POST");
    res.status(204).end();
  });
  return app;
}

describe("security middleware", () => {
  it("sets Content-Security-Policy header on GET /", async () => {
    const res = await request(buildApp()).get("/");
    expect(res.status).toBe(200);
    const csp = res.headers["content-security-policy"];
    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("horizon-testnet.stellar.org");
    expect(csp).toContain("channels.openzeppelin.com");
    expect(csp).toContain("api.groq.com");
  });

  it("sets X-Content-Type-Options: nosniff", async () => {
    const res = await request(buildApp()).get("/");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("sets X-Frame-Options", async () => {
    const res = await request(buildApp()).get("/");
    expect(res.headers["x-frame-options"]).toBeDefined();
  });

  it("does NOT set HSTS in non-production", async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    const res = await request(buildApp()).get("/");
    process.env.NODE_ENV = prev;
    expect(res.headers["strict-transport-security"]).toBeUndefined();
  });

  it("sets HSTS in production", async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const res = await request(buildApp()).get("/");
    process.env.NODE_ENV = prev;
    const hsts = res.headers["strict-transport-security"];
    expect(hsts).toBeDefined();
    expect(hsts).toContain("max-age=31536000");
    expect(hsts).toContain("includeSubDomains");
  });

  it("OPTIONS /agent/run preflight preserves CORS headers alongside helmet", async () => {
    const res = await request(buildApp()).options("/agent/run");
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });
});
