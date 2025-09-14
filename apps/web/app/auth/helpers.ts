import { env } from "../env";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const AUTH_COOKIE_NAME = 'envie_token';

interface AuthenticatedUser {
  userId: string;
  username: string;
  pubkey?: string | null;
}

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    
    if (!token) {
      return null;
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as AuthenticatedUser;
    
    return {
      userId: decoded.userId,
      username: decoded.username,
      pubkey: decoded.pubkey || null
    };
  } catch (error) {
    // JWT verification failed or other error
    return null;
  }
}