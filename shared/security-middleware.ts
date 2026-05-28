import helmet from "helmet";
import type { Application } from "express";

export function applySecurityMiddleware(app: Application): void {
  const isProd = process.env.NODE_ENV === "production";
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          connectSrc: [
            "'self'",
            "https://horizon-testnet.stellar.org",
            "https://channels.openzeppelin.com",
            "https://api.groq.com",
          ],
        },
      },
      crossOriginResourcePolicy: { policy: "cross-origin" },
      hsts: isProd
        ? { maxAge: 31536000, includeSubDomains: true }
        : false,
    }),
  );
}
