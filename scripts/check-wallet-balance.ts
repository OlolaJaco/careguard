#!/usr/bin/env node
/**
 * Wallet low-balance check — runnable on cron.
 *
 * Loads the agent wallet, compares USDC/XLM against thresholds, and on
 * breach: pauses the agent (in-process state — only effective when run as
 * the same process as the server) plus sends a notification and writes an
 * audit log entry.
 *
 * Usage:
 *   npm run wallet:check
 *   # or via cron (e.g. crontab):
 *   #   *\/15 * * * * cd /app && npm run wallet:check >> /var/log/wallet.log 2>&1
 *
 * For multi-process deploys (cron on one box, server on another), the
 * pause flip in this script will not propagate. In that case, run the
 * in-process scheduler instead by setting WALLET_BALANCE_CHECK_ENABLED=1
 * in the server environment.
 */

import "dotenv/config";
import { checkWalletBalance, formatResult } from "../shared/wallet-balance.ts";
import { logger } from "../shared/logger.ts";

async function main() {
  const result = await checkWalletBalance();
  logger.info({ result: formatResult(result) }, "wallet check");
  if (result.action === "error") process.exit(1);
  process.exit(0);
}

main().catch((err) => {
  logger.error({ err: err?.message ?? err }, "wallet check crashed");
  process.exit(1);
});
