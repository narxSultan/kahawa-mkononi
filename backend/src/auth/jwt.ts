import jwt from "jsonwebtoken";
import type { Secret, SignOptions } from "jsonwebtoken";

export type JwtUser = {
  sub: string;
  role: string;
  serviceCentreId?: string | null;
};

export function signAccessToken(
  payload: JwtUser,
  secret: Secret,
  expiresIn: string
): string {
  return jwt.sign(payload, secret, { expiresIn: expiresIn as SignOptions["expiresIn"] });
}

export function signRefreshToken(
  payload: JwtUser,
  secret: Secret,
  expiresIn: string
): string {
  return jwt.sign(payload, secret, { expiresIn: expiresIn as SignOptions["expiresIn"] });
}

export function verifyToken<T extends object>(token: string, secret: string): T {
  return jwt.verify(token, secret) as T;
}
