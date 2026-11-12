import "server-only";
import { z } from "zod";
import { getAppContext, type AppContext } from "@/lib/context";
import { can, type Capability } from "@/lib/permissions";
import type { ActionState } from "@/components/action-form";

export function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Empty form strings become undefined so optional zod fields behave. */
export function formObject(formData: FormData): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  formData.forEach((v, k) => {
    if (typeof v === "string") out[k] = v.trim() === "" ? undefined : v.trim();
  });
  return out;
}

export const optionalNumber = z.preprocess(
  (v) => (v === undefined || v === "" ? undefined : Number(v)),
  z.number({ invalid_type_error: "Enter a number" }).optional(),
);
export const optionalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date").optional();

const DB_MESSAGES: Record<string, string> = {
  vehicle_limit_reached: "Your plan's vehicle limit has been reached. Upgrade the plan to add more vehicles.",
  trial_expired: "The free trial has ended. Choose a plan to continue adding vehicles.",
  subscription_cancelled: "The subscription is cancelled. Reactivate it to add vehicles.",
  forbidden: "You do not have permission to do that.",
  forbidden_role: "You do not have permission to assign that role.",
  driver_not_active: "That driver is not active.",
  vehicle_not_available: "That vehicle is retired or inactive.",
  not_found: "That record could not be found.",
  invalid_circle: "Enter a valid centre point and a radius greater than 0.",
  invalid_polygon: "A polygon needs at least 3 points.",
  cannot_modify_owner: "The owner's role cannot be changed.",
  cannot_modify_self: "You cannot change your own role or access.",
  cannot_invite_owner: "Ownership cannot be granted by invitation.",
  invalid_email: "Enter a valid email address.",
  member_not_found: "That member could not be found.",
};

/** Turns a Postgres / PostgREST error into something a person can act on. */
export function dbErrorMessage(error: { message: string; code?: string }, fallback = "Could not save. Please try again."): string {
  const key = Object.keys(DB_MESSAGES).find((k) => error.message.includes(k));
  if (key) return DB_MESSAGES[key];
  if (error.code === "23505") return "That record already exists (a duplicate registration number or identifier).";
  if (error.code === "23503") return "That record is linked to another record that does not belong to this organisation.";
  if (error.code === "42501") return "You do not have permission to do that.";
  return fallback;
}

export async function actionContext(capability: Capability): Promise<{ ctx: AppContext } | { error: ActionState }> {
  const ctx = await getAppContext();
  if (!can(ctx.role, capability)) return { error: { ok: false, message: "You do not have permission to do that." } };
  return { ctx };
}

export function parseForm<T extends z.ZodTypeAny>(schema: T, formData: FormData):
  { data: z.infer<T> } | { error: ActionState } {
  const parsed = schema.safeParse(formObject(formData));
  if (!parsed.success) return { error: { ok: false, errors: fieldErrors(parsed.error), message: "Please fix the highlighted fields." } };
  return { data: parsed.data };
}
