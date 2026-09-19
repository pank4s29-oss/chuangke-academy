import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  content: ["./src/app/**/*.{js,ts,jsx,tsx,mdx}", "./src/components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: { extend: {} },
  // Registers the `prose` / `prose-*` classes already used throughout
  // StageSourceContent.tsx and TaskFlow.tsx to lay out lecture and
  // assignment markdown. Without this plugin those classes don't exist, so
  // Tailwind's Preflight reset (which zeroes out default margins on
  // headings/paragraphs/lists/tables) was left unopposed — every block sat
  // flush against the next with no vertical rhythm at all, which is the
  // main cause of the lecture content reading as cramped.
  plugins: [typography],
};

export default config;
