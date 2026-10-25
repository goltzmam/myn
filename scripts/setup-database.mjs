import { readFileSync, readdirSync } from "node:fs";
if (!process.env.SUPABASE_ACCESS_TOKEN)
  throw new Error(
    "Configure SUPABASE_ACCESS_TOKEN securely; never paste it in chat. Alternatively run public/setup/myn-database.sql in your Supabase SQL Editor.",
  );
const hostname = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "").hostname;
const project = hostname.match(/^([a-z0-9]+)\.supabase\.co$/)?.[1];
if (!project) throw new Error("A valid Supabase project URL is required.");
const query = readdirSync("supabase/migrations")
  .filter((n) => n.endsWith(".sql"))
  .sort()
  .map((n) => readFileSync("supabase/migrations/" + n, "utf8"))
  .join("\n");
const response = await fetch(
  `https://api.supabase.com/v1/projects/${project}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: "Bearer " + process.env.SUPABASE_ACCESS_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(60000),
  },
);
if (!response.ok) {
  console.error(
    "Database setup failed. Management API HTTP " + response.status,
  );
  process.exitCode = 1;
} else console.log("MYN database migration applied successfully.");
