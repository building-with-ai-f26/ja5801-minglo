import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { resolve, join } from "node:path";

// Isolated project database; does not touch any system PostgreSQL service.
const root = resolve(import.meta.dirname, "..");
const local = join(root, ".local");
const data = join(local, "postgres");
const candidates = [
  process.env.PG_BIN,
  "/opt/homebrew/opt/postgresql@15/bin",
  "/opt/homebrew/opt/postgresql@16/bin",
  "/usr/local/opt/postgresql@16/bin",
].filter(Boolean);
const bin = candidates.find((p) => existsSync(join(p, "initdb")));
if (!bin) {
  console.error(
    "Set PG_BIN to your PostgreSQL bin directory, or configure .env with an existing PostgreSQL DATABASE_URL and run npm run db:migrate.",
  );
  process.exit(1);
}
const run = (name, args, options = {}) =>
  execFileSync(join(bin, name), args, {
    cwd: root,
    stdio: "inherit",
    ...options,
  });
mkdirSync(local, { recursive: true });
if (!existsSync(join(data, "PG_VERSION")))
  run("initdb", [
    "-D",
    data,
    "-A",
    "trust",
    "--username",
    "minglo",
    "--no-locale",
    "--encoding",
    "UTF8",
  ]);
let running = false;
try {
  run("pg_ctl", ["-D", data, "status"], { stdio: "ignore" });
  running = true;
} catch {}
if (!running)
  run("pg_ctl", [
    "-D",
    data,
    "-l",
    join(local, "postgres.log"),
    "-o",
    "-h 127.0.0.1 -p 55432 -k " + local,
    "-w",
    "start",
  ]);
const dbs = execFileSync(
  join(bin, "psql"),
  [
    "-h",
    "127.0.0.1",
    "-p",
    "55432",
    "-U",
    "minglo",
    "-d",
    "postgres",
    "-Atc",
    "SELECT datname FROM pg_database WHERE datname IN ('minglo','minglo_test')",
  ],
  { encoding: "utf8" },
);
for (const name of ["minglo", "minglo_test"])
  if (!dbs.split("\n").includes(name))
    run("createdb", ["-h", "127.0.0.1", "-p", "55432", "-U", "minglo", name]);
if (!existsSync(join(root, ".env"))) {
  const sample = readFileSync(join(root, ".env.example"), "utf8");
  writeFileSync(
    join(root, ".env"),
    sample.replace(
      "replace-with-a-random-secret-at-least-32-characters",
      randomBytes(48).toString("base64url"),
    ),
    { mode: 0o600 },
  );
  console.log("Created gitignored .env with a random session secret.");
}
console.log(
  "Minglo PostgreSQL is ready at 127.0.0.1:55432. Run npm run db:migrate.",
);
