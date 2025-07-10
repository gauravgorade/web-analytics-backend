import jwt from "jsonwebtoken";
import { config } from "../config";

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
