import type { TFunction } from "i18next";
import * as z from "zod";
import { STRING_SIZE_LIMITS } from "@/utils/validation";

// Form validation schemas
export const formSchema = (t: TFunction) =>
  z.object({
    mwp: z
      .string()
      .min(1, { message: t("forms.mwpRequired") })
      .max(STRING_SIZE_LIMITS.MWP_MAX_LENGTH, {
        message: t("forms.mwpTooLong", { max: STRING_SIZE_LIMITS.MWP_MAX_LENGTH }),
      }),
    formula: z
      .string()
      .optional()
      .refine(
        (val) => !val || val.length <= STRING_SIZE_LIMITS.FORMULA_MAX_LENGTH,
        {
          message: t("forms.formulaTooLong", { max: STRING_SIZE_LIMITS.FORMULA_MAX_LENGTH }),
        }
      ),
    hint: z
      .string()
      .optional()
      .refine(
        (val) => !val || val.length <= STRING_SIZE_LIMITS.HINT_MAX_LENGTH,
        {
          message: t("forms.hintTooLong", { max: STRING_SIZE_LIMITS.HINT_MAX_LENGTH }),
        }
      ),
  });

export const vlFormSchema = (t: TFunction) =>
  z.object({
    dsl: z
      .string()
      .min(1, { message: t("forms.dslRequired") })
      .max(STRING_SIZE_LIMITS.DSL_MAX_LENGTH, {
        message: t("forms.dslTooLong", { max: STRING_SIZE_LIMITS.DSL_MAX_LENGTH }),
      }),
  });

// Export inferred types for convenience
export type FormData = z.infer<ReturnType<typeof formSchema>>;
export type VLFormData = z.infer<ReturnType<typeof vlFormSchema>>;