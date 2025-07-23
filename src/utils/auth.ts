import jwt from "jsonwebtoken";
import { pool } from "../db";
import { config } from "../config";
import { errorResponse } from "../utils/response";

// --- Get User ID from Request Header ---
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

// --- Check if a User Owns a Site ---
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

// --- Ensure User is Authenticated ---
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

// --- Combined Check for Auth + Site Access ---
export async function authorizeSiteAccess(context: any, siteId: string) {
  const auth = assertAuthenticated(context);
  if (!auth.success) return auth;

  const privilegeCheck = await assertUserOwnsSite(auth.userId, siteId);
  if (!privilegeCheck.success) return privilegeCheck;

  return { success: true, userId: auth.userId };
}

// --- Get Full User Info by ID ---
export async function getUserById(userId: string) {
  try {
    const result = await pool.query(
      `SELECT id, name, email, timezone, date_format FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rowCount === 0) return null;

    const user = result.rows[0];
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      timezone: user.timezone,
      dateFormat: user.date_format,
    };
  } catch (err) {
    console.error("Error fetching user by ID:", err);
    return null;
  }
}
