import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, i, all) => value.startsWith("--") ? [...pairs, [value.slice(2), all[i + 1]]] : pairs, []));
if (!args.manifest || args.mode !== "draft" || !args.report) throw new Error("Expected --manifest <file> --mode draft --report <file>");
const manifest = JSON.parse(await readFile(args.manifest, "utf8"));
const stages = [...new Set(manifest.entries.flatMap((entry) => (entry.path ?? entry.oldPath ?? "").match(/^content\/source\/(stage-\d{2,3})\//)?.[1] ?? []))];
const results = [];
for (const stageKey of stages) {
  const directory = path.join("content", "source", stageKey);
  let files = [];
  try { files = (await readdir(directory)).filter((file) => file.endsWith(".md")).sort(); } catch { results.push({ stageKey, status: "warning", warnings: ["Stage source folder no longer exists; published content remains untouched."] }); continue; }
  const sources = await Promise.all(files.map(async (file) => ({ path: path.posix.join("content/source", stageKey, file), body: (await readFile(path.join(directory, file), "utf8")).replace(/\r\n/g, "\n") })));
  const hash = createHash("sha256").update(sources.map((source) => `${source.path}\0${source.body}`).join("\0")).digest("hex");
  const headings = sources.flatMap((source) => [...source.body.matchAll(/^(#{1,3})\s+(.+)$/gm)].map((match) => ({ level: match[1].length, text: match[2] })));
  results.push({ stageKey, status: files.length >= 2 ? "draft_ready" : "warning", sourceHash: hash, parserVersion: "1.0.0", sourceFiles: sources.map(({ path }) => path), headings, warnings: files.length >= 2 ? ["Canonical question mapping requires a reviewed manifest; no published content was changed."] : ["Expected both lecture and assignment source files."] });
}
const report = { schemaVersion: 1, mode: "draft", commitSha: manifest.commitSha, results, createdAt: new Date().toISOString() };
await writeFile(args.report, JSON.stringify(report, null, 2));
if (results.some((result) => result.status === "warning")) process.exitCode = 1;
