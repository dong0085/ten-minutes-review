import { context } from "esbuild";
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

const args = process.argv.slice(2);
const watch = args.includes("--watch");
const requested = args.filter((arg) => !arg.startsWith("--"));

const ALL_TARGETS = [
  { name: "chrome", target: "chrome120" },
  { name: "firefox", target: "firefox128" },
];
const targets = ALL_TARGETS.filter(
  (entry) => requested.length === 0 || requested.includes(entry.name),
);
if (targets.length === 0) {
  console.error(`Unknown target(s): ${requested.join(", ")}`);
  process.exit(1);
}

// Bake a production API origin into the manifest's default host permission.
const origin = process.env.EXT_API_ORIGIN?.replace(/\/+$/, "");
const manifest = JSON.parse(await readFile(path.join(root, "src/manifest.common.json"), "utf8"));
if (origin) {
  manifest.host_permissions = [`${origin}/*`];
}

const ENTRIES = [
  ["background/index.ts", "background.js"],
  ["popup/popup.ts", "popup.js"],
];

for (const target of targets) {
  const outdir = path.join(root, "dist", target.name);
  if (!watch) {
    await rm(outdir, { recursive: true, force: true });
  }
  await mkdir(path.join(outdir, "icons"), { recursive: true });

  // IIFE so the same artifact runs as a Chrome classic service worker and a
  // Firefox event-page script.
  for (const [input, output] of ENTRIES) {
    const buildContext = await context({
      entryPoints: [path.join(root, "src", input)],
      outfile: path.join(outdir, output),
      bundle: true,
      format: "iife",
      minify: !watch,
      sourcemap: watch ? "inline" : false,
      target: target.target,
      logLevel: "info",
    });
    if (watch) {
      buildContext.watch();
    } else {
      await buildContext.rebuild();
      await buildContext.dispose();
    }
  }

  await copyFile(path.join(root, "src/popup/popup.html"), path.join(outdir, "popup.html"));
  await copyFile(path.join(root, "src/popup/popup.css"), path.join(outdir, "popup.css"));
  for (const icon of await readdir(path.join(root, "src/icons"))) {
    await copyFile(path.join(root, "src/icons", icon), path.join(outdir, "icons", icon));
  }

  const targetManifest = { ...manifest };
  if (target.name === "chrome") {
    targetManifest.background = { service_worker: "background.js" };
  } else {
    targetManifest.background = { scripts: ["background.js"] };
    targetManifest.browser_specific_settings = {
      gecko: { id: "notes@tenminutereview.app", strict_min_version: "128.0" },
    };
  }
  await writeFile(
    path.join(outdir, "manifest.json"),
    `${JSON.stringify(targetManifest, null, 2)}\n`,
  );
  console.log(`built dist/${target.name}`);
}
