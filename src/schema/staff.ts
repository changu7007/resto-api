import * as z from "zod";

export const staffSchema = z.object({
  email: z.string().min(1, { message: "Provide email address" }),
  password: z.string(),
});

export const userSchema = z.object({
  email: z.string().min(1, { message: "Provide email address" }),
  password: z.string(),
});
