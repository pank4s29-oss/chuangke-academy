import fs from "node:fs";
import path from "node:path";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = { stageKey: string };

function readSources(stageKey: string) {
  const directory = path.join(process.cwd(), "content", "source", stageKey);
  return fs.readdirSync(directory).filter((file) => file.endsWith(".md") && file.toLowerCase() !== "readme.md").sort().map((file) => ({ file, body: fs.readFileSync(path.join(directory, file), "utf8") }));
}

export default function StageSourceContent({ stageKey }: Props) {
  const sources = readSources(stageKey);
  return <section className="border-t border-slate-200 bg-[#eef3ef] px-5 py-12 lg:px-8"><div className="mx-auto max-w-6xl"><div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-700">完整教材閱讀區</p><h2 className="mt-3 text-3xl font-bold tracking-tight">這個階段的正式講義與作業</h2><p className="mt-4 leading-7 text-slate-600">以下內容直接來自 repository 的 `content/source/{stageKey}`。你可以先依照上方任務操作，再回到這裡查閱完整脈絡；系統不會截斷或改寫教材原文。</p></div><div className="mt-8 space-y-5">{sources.map((source) => <details key={source.file} open className="group overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200/70"><summary className="cursor-pointer list-none px-6 py-5 font-semibold marker:hidden lg:px-8"><span className="mr-3 text-teal-700">{source.file.includes("講義") ? "講義" : "作業"}</span>{source.file}<span className="float-right text-slate-400 transition group-open:rotate-180">⌄</span></summary><div className="md-content max-w-none border-t border-slate-100 px-6 py-7 lg:px-12 lg:py-10"><ReactMarkdown remarkPlugins={[remarkGfm]}>{source.body}</ReactMarkdown></div></details>)}</div></div></section>;
}
