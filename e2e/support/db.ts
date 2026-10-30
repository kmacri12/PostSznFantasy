import { execFileSync } from "node:child_process";
import path from "node:path";
import { E2E_DATABASE_URL } from "./env";

const repoRoot = path.resolve(import.meta.dirname, "../..");

/** Runs one of the api/scripts seeders against the e2e database. */
export const runSeedScript = (module: string, ...args: string[]): void => {
  execFileSync("uv", ["run", "--project", "api", "python", "-m", module, ...args], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PG_URI: E2E_DATABASE_URL,
      SUPABASE_URL: "http://localhost:54321",
      ENVIRONMENT: "test",
      LOG_FORMAT: "console",
    },
    stdio: "pipe",
  });
};
