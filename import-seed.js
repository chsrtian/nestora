#!/usr/bin/env node

async function main() {
  const { spawnSync } = await import("node:child_process");
  const fs = await import("node:fs");
  const path = await import("node:path");

  const rootDir = process.cwd();
  const sqlFiles = [
    path.join(
      rootDir,
      "supabase",
      "migrations",
      "0007_property_seed_verification_metadata.sql",
    ),
    path.join(rootDir, "supabase", "seed.ph-demo.sql"),
    path.join(rootDir, "supabase", "seed.ph-demo.validation.sql"),
  ];
  const validationFiles = [
    path.join(rootDir, "supabase", "seed.ph-demo.validation.sql"),
  ];

  function loadEnvFile(fileName) {
    const envPath = path.join(rootDir, fileName);
    if (!fs.existsSync(envPath)) return;

    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match) continue;

      let value = match[2];
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (!process.env[match[1]]) {
        process.env[match[1]] = value;
      }
    }
  }

  function runPsql(databaseUrl, filePath) {
    console.log(`Running ${path.relative(rootDir, filePath)}...`);
    const result = spawnSync(
      "psql",
      [databaseUrl, "--set=ON_ERROR_STOP=1", "--file", filePath],
      {
        cwd: rootDir,
        stdio: "inherit",
        shell: process.platform === "win32",
      },
    );

    if (result.error?.code === "ENOENT") {
      console.error("Unable to find psql. Install PostgreSQL client tools first.");
      process.exit(1);
    }

    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  }

  loadEnvFile(".env.local");
  loadEnvFile(".env");

  const databaseUrl = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
  const validateOnly = process.argv.includes("--validate-only");

  if (!databaseUrl) {
    console.error(
      [
        "Set SUPABASE_DB_URL before importing or validating seed data.",
        "Use the Supabase direct PostgreSQL connection string, not the anon key.",
        "Example:",
        "  SUPABASE_DB_URL=postgresql://postgres:<password>@<host>:5432/postgres npm run seed:ph",
      ].join("\n"),
    );
    process.exit(1);
  }

  const files = validateOnly ? validationFiles : sqlFiles;
  for (const filePath of files) {
    if (!fs.existsSync(filePath)) {
      console.error(`Missing SQL file: ${filePath}`);
      process.exit(1);
    }

    runPsql(databaseUrl, filePath);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
