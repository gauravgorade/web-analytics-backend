import jwt from "jsonwebtoken";
import { pool } from "../db";
import { config } from "../config";
import { errorResponse } from "../utils/response";

export function getUserIdFromRequest(req: any): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  try {
    const decoded = jwt.verify(authHeader, config.JWT_SECRET) as { userId: string };
    return decoded.userId;
  } catch (err) {
    console.error("Invalid token:", err);
    return null;
  }
}

export async function assertUserOwnsSite(userId: string, siteId: string) {
  const result = await pool.query(`SELECT 1 FROM sites WHERE id = $1 AND user_id = $2`, [
    siteId,
    userId,
  ]);

  if (result.rowCount === 0) {
    return errorResponse("Unauthorized: Site does not belong to user.");
  }

  return { success: true };
}

type AuthSuccess = { success: true; userId: string };
type AuthError = { success: false; message: string; data?: any };

export function assertAuthenticated(context: { userId?: string }): AuthSuccess | AuthError {
  if (!context.userId) {
    return {
      success: false,
      message: "Unauthorized: User not authenticated.",
    };
  }

  return { success: true, userId: context.userId };
}
