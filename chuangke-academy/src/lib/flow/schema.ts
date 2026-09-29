import { z } from "zod";

export const sourceRefSchema = z.object({ file: z.string(), heading: z.string().optional(), step: z.string().optional() });
export const optionSchema = z.object({ id: z.string(), label: z.string(), hint: z.string().optional(), other: z.boolean().optional() });
export const blockSchema = z.object({
  type: z.enum(["heading", "prose", "lecture", "choice", "text", "textarea", "sentence", "check", "callout", "blueprint"]),
  key: z.string().optional(), label: z.string().optional(), prompt: z.string().optional(), description: z.string().optional(),
  options: z.array(optionSchema).optional(), multiple: z.boolean().optional(), max: z.number().optional(),
  derive: z.string().optional(), placeholder: z.string().optional(), sourceRef: sourceRefSchema.optional(),
});
export const pageSchema = z.object({ id: z.string(), part: z.string(), title: z.string(), description: z.string().optional(), sourceRef: sourceRefSchema.optional(), requiredToAdvance: z.boolean().default(false), blocks: z.array(blockSchema) });
export const flowSchema = z.object({ label: z.string(), parts: z.array(z.object({ id: z.string(), label: z.string(), pageIds: z.array(z.string()) })), pages: z.array(pageSchema) });
export const questionSchema = z.object({ id: z.string(), label: z.string(), type: z.string(), legacyKeys: z.array(z.string()).default([]), options: z.array(optionSchema).optional(), sourceRef: sourceRefSchema.optional() });
export const derivedSchema = z.object({ id: z.string(), op: z.string(), inputs: z.array(z.string()).default([]), args: z.record(z.unknown()).optional(), sourceRef: sourceRefSchema.optional(), origin: z.enum(["source", "source-derived", "artifact-only"]) });
export const flowDocumentSchema = z.object({ schemaVersion: z.number(), stage: z.string(), title: z.string(), flows: z.record(flowSchema), questions: z.record(questionSchema), derived: z.record(derivedSchema).default({}), blueprint: z.object({ sections: z.array(z.object({ id: z.string(), label: z.string(), source: z.string().optional(), derive: z.string().optional() })) }).default({ sections: [] }), legacyKeyMap: z.record(z.string()).default({}), dropped: z.array(z.object({ legacyKey: z.string(), reason: z.string() })).default([]) });
export type FlowDocument = z.infer<typeof flowDocumentSchema>;
export type Flow = z.infer<typeof flowSchema>;
export type FlowPage = z.infer<typeof pageSchema>;
export type FlowBlock = z.infer<typeof blockSchema>;
export type Answers = Record<string, string | string[] | number | boolean | undefined>;

export function parseFlowDocument(value: unknown) { return flowDocumentSchema.parse(value); }
