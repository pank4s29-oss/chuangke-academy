import "server-only";
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { parseFlowDocument, type FlowDocument } from "./schema";
import { validateFlow } from "./validate";
export function loadFlow(stageKey: string): { document: FlowDocument; issues: ReturnType<typeof validateFlow>["issues"] } | null {
  const file = path.join(process.cwd(), "content", "source", stageKey, "flow.yaml");
  if (!fs.existsSync(file)) return null;
  const document = parseFlowDocument(parseYaml(fs.readFileSync(file, "utf8")));
  const source = fs.readdirSync(path.dirname(file)).find((name) => name.includes("作業") && name.endsWith(".md"));
  const markdown = source ? fs.readFileSync(path.join(path.dirname(file), source), "utf8") : "";
  return { document, issues: validateFlow(document, markdown).issues };
}
