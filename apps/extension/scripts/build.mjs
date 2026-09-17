import { context } from "esbuild";
import { execFileSync } from "node:child_process";
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

const args = process.argv.slice(2);
const watch = args.includes("--watch");
const store = args.includes("--store");
const zip = args.includes("--zip");
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

// The default server this build targets: EXT_API_ORIGIN (self-hosting, local
// development), otherwise the production site. It feeds both the manifest's
// host permissions and the code's base URL via --define, so they can't drift.
// --store drops the localhost permission (dev-only) to keep store reviews clean.
const PRODUCTION_ORIGIN = "https://ten-minutes-review.vercel.app";
const origin = process.env.EXT_API_ORIGIN?.replace(/\/+$/, "");
const defaultOrigin = origin ?? PRODUCTION_ORIGIN;
if (store && defaultOrigin === "http://localhost:3000") {
  console.error("A store build cannot target localhost.");
  process.exit(1);
}

const manifest = JSON.parse(await readFile(path.join(root, "src/manifest.common.json"), "utf8"));
manifest.host_permissions = [`${defaultOrigin}/*`];
if (!store) {
  manifest.host_permissions.push("http://localhost:3000/*");
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
  // Firefox event-page script. Store builds stay unminified: AMO flags
  // minified bundles and demands a separate source-code submission.
  for (const [input, output] of ENTRIES) {
    const buildContext = await context({
      entryPoints: [path.join(root, "src", input)],
      outfile: path.join(outdir, output),
      bundle: true,
      format: "iife",
      minify: !store && !watch,
      sourcemap: watch ? "inline" : false,
      target: target.target,
      define: { __TMR_API_ORIGIN__: JSON.stringify(defaultOrigin) },
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
      gecko: {
        id: "notes@tenminutereview.app",
        strict_min_version: "128.0",
        // Firefox requires an explicit declaration; the extension collects no data.
        data_collection_permissions: { required: ["none"] },
      },
    };
  }
  await writeFile(
    path.join(outdir, "manifest.json"),
    `${JSON.stringify(targetManifest, null, 2)}\n`,
  );
  console.log(`built dist/${target.name}`);
}

// Store-ready zips: manifest.json at the archive root, as both stores expect.
if (zip) {
  const webstoreDir = path.join(root, "dist", "webstore");
  await mkdir(webstoreDir, { recursive: true });
  for (const target of targets) {
    execFileSync("zip", ["-r", "-q", path.join(webstoreDir, `${target.name}.zip`), "."], {
      cwd: path.join(root, "dist", target.name),
    });
    console.log(`zipped dist/webstore/${target.name}.zip`);
  }
}
