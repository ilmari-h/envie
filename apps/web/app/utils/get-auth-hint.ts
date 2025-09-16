import { z } from "zod";

const authHintPayloadSchema = z.object({
  exp: z.number(),
  userId: z.string(),
  username: z.string(),
});

export function getAuthHint() {
  if (typeof document === "undefined") return null;
  
  const cookie = document.cookie
    .split("; ")
    .find(row => row.startsWith("envie_token_expiry="));
  
  if (!cookie) return null;
  
  const cookieValue = cookie.split("=")[1];
  if (!cookieValue) return null;
  
  try {
    const payload = JSON.parse(decodeURIComponent(cookieValue));
    const validatedPayload = authHintPayloadSchema.parse(payload);
    
    // Check if token is still valid (exp is in future)
    const now = Math.floor(Date.now() / 1000);
    if (validatedPayload.exp <= now) return null;
    
    return validatedPayload;
  } catch {
    return null;
  }
}