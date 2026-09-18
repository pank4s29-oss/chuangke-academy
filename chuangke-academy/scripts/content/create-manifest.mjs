import { execFileSync } from "node:child_process"; import { writeFile } from "node:fs/promises";
const stage = process.argv[2]?.trim(); const files = execFileSync("git", ["ls-files", "content/source"], { encoding:"utf8" }).split("\n").filter(Boolean).filter((p) => p.endsWith(".md") && (!stage || p.includes(`/${stage}/`)));
await writeFile(".content-sync/manifest.json", JSON.stringify({schemaVersion:1,mode:"draft",commitSha:process.env.GITHUB_SHA ?? "local",entries:files.map((path)=>({status:"M",path}))},null,2));
