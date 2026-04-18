import { z } from "zod";

export const waitlistSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  role: z.enum(["buyer", "seller", "both"]).optional(),
  company: z.string().max(200).optional(),
});

export type WaitlistInput = z.infer<typeof waitlistSchema>;
