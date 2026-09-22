// Pure, dependency-free helpers for reasoning about an AssignmentField's
// current state. Deliberately kept separate from taskSections.ts: that file
// reads course content off disk with "node:fs"/"node:path", which is fine
// for server-only callers but breaks the client bundle the moment a "use
// client" component (TaskFlow, RecallMarkdown) imports a *value* — as
// opposed to a type-only — export from it, since webpack then has to bundle
// the fs/path imports for the browser and fails with "UnhandledSchemeError:
// Reading from 'node:fs' is not handled by plugins". Client components must
// import isFieldActive/stepOrdinal from here, not from taskSections.ts.
import type { AssignmentField } from "./taskSections";

/** Extracts the leading ordinal from a sub-heading such as "步驟 2：…",
 *  "槓桿 2：…" or "第 4 格：…" so a qualifier following a cross-reference code
 *  (e.g. "1.1-B 步驟 2", "2.2-A 第 4 格") can be matched back to the field(s)
 *  filed under that specific sub-heading, instead of the section's first
 *  field regardless of which step the text actually points at. */
export function stepOrdinal(headingText?: string): number | null {
  if (!headingText) return null;
  const match = headingText.match(/(?:步驟|槓桿|第)\s*([0-9]+)\s*(?:格|項|問)?/);
  return match ? Number(match[1]) : null;
}

/** Whether `field` should currently be shown/counted, given `answers` for its
 *  own stage — i.e. its `dependsOn` branch (if any) is the one selected.
 *  Fields with no `dependsOn` are always active. This is the single source of
 *  truth for branch visibility; both the live assignment form (TaskFlow) and
 *  the cross-reference review popup (RecallMarkdown) must agree on which of
 *  several mutually-exclusive branch fields is "the" answer for a section. */
export function isFieldActive(field: Pick<AssignmentField, "dependsOn">, answers: Record<string, string | string[] | undefined>) {
  if (!field.dependsOn) return true;
  const value = answers[field.dependsOn.fieldKey];
  return Array.isArray(value) ? value.includes(field.dependsOn.optionKey) : value === field.dependsOn.optionKey;
}
