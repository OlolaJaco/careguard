/**
 * Dev server startup script — starts all CareGuard services.
 * Replaces concurrently to avoid Node 24 + tsx loader process tracking issues.
 */

import { spawn, type ChildProcess } from "child_process";
import { logger } from "../shared/logger.ts";

const SERVICES = [
  { name: "pharmacy", script: "services/pharmacy-api/server.ts", color: "\x1b[36m" },       // cyan
  { name: "billing",  script: "services/bill-audit-api/server.ts", color: "\x1b[33m" },      // yellow
  { name: "drugs",    script: "services/drug-interaction-api/server.ts", color: "\x1b[35m" }, // magenta
  { name: "mpp",      script: "services/pharmacy-payment/server.ts", color: "\x1b[34m" },    // blue
  { name: "agent",    script: "agent/server.ts", color: "\x1b[32m" },                         // green
];

const RESET = "\x1b[0m";
const children: ChildProcess[] = [];

function log(name: string, color: string, data: string) {
  const lines = data.toString().trim().split("\n");
  for (const line of lines) {
    process.stdout.write(`${color}[${name}]${RESET} ${line}\n`);
  }
}

for (const svc of SERVICES) {
  const child = spawn("node", ["--import", "tsx", svc.script], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env },
  });

  child.stdout?.on("data", (data) => log(svc.name, svc.color, data.toString()));
  child.stderr?.on("data", (data) => log(svc.name, "\x1b[31m", data.toString()));

  child.on("exit", (code) => {
    log(svc.name, "\x1b[31m", `exited with code ${code}`);
    // If any service crashes, kill all others
    if (code !== 0 && code !== null) {
      logger.error({ service: svc.name }, "service crashed, shutting down all services");
      for (const c of children) c.kill();
      process.exit(1);
    }
  });

  children.push(child);
}

// Handle Ctrl+C gracefully
process.on("SIGINT", () => {
  logger.info("shutting down all services");
  for (const c of children) c.kill();
  process.exit(0);
});

process.on("SIGTERM", () => {
  for (const c of children) c.kill();
  process.exit(0);
});

logger.info({ count: SERVICES.length }, "starting CareGuard services");
