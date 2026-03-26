import { verify } from 'jsonwebtoken';
import type { IUser } from '../models/user.model';
import { User } from '../models/user.model';

type JwtPayload = {
  id?: string;
};

function extractBearerToken(authorizationHeaderValue: unknown): string | null {
  if (typeof authorizationHeaderValue !== 'string') return null;
  if (!authorizationHeaderValue.startsWith('Bearer ')) return null;
  const token = authorizationHeaderValue.split(' ')[1];
  return token || null;
}

export async function getUserFromBearerAuthHeader(
  authorizationHeaderValue: unknown
): Promise<IUser | null> {
  const token = extractBearerToken(authorizationHeaderValue);
  if (!token) return null;
  return getUserFromJwt(token);
}

export async function getUserFromJwt(token: string): Promise<IUser | null> {
  try {
    const decoded = verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_here') as JwtPayload;
    if (!decoded?.id) return null;
    return await User.findById(decoded.id).exec();
  } catch {
    return null;
  }
}

export function getTokenFromConnectionParams(connectionParams: unknown): string | null {
  if (!connectionParams || typeof connectionParams !== 'object') return null;
  const cp = connectionParams as Record<string, unknown>;

  const direct =
    (typeof cp.authorization === 'string' ? cp.authorization : null) ??
    (typeof cp.Authorization === 'string' ? cp.Authorization : null);
  const bearer = extractBearerToken(direct);
  if (bearer) return bearer;

  const token =
    (typeof cp.token === 'string' ? cp.token : null) ??
    (typeof cp.authToken === 'string' ? cp.authToken : null) ??
    (typeof cp.jwt === 'string' ? cp.jwt : null);
  return token || null;
}

