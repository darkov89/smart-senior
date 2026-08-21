import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const webRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const openNext = join(webRoot, ".open-next");
const outDir = join(webRoot, ".pages-deploy");
const projectName = "smart-senior";

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

cpSync(join(openNext, "assets"), outDir, { recursive: true });
cpSync(join(openNext, "worker.js"), join(outDir, "_worker.js"));
cpSync(join(openNext, "cloudflare"), join(outDir, "cloudflare"), {
  recursive: true,
});
cpSync(join(openNext, "middleware"), join(outDir, "middleware"), {
  recursive: true,
});
cpSync(join(openNext, "server-functions"), join(outDir, "server-functions"), {
  recursive: true,
});
cpSync(join(openNext, ".build"), join(outDir, ".build"), { recursive: true });

writeFileSync(
  join(outDir, "_routes.json"),
  `${JSON.stringify(
    {
      version: 1,
      include: ["/*"],
      exclude: ["/_next/static/*", "/favicon.ico", "/*.svg", "/*.ico"],
    },
    null,
    2,
  )}\n`,
);

const result = spawnSync(
  "npx",
  [
    "wrangler",
    "pages",
    "deploy",
    outDir,
    "--project-name",
    projectName,
    "--branch",
    "main",
    "--commit-dirty=true",
  ],
  { cwd: webRoot, stdio: "inherit" },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
