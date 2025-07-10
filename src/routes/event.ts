import { Router, Request, Response } from "express";
import { pool } from "../db";

const router = Router();

router.post("/", async (req: Request, res: Response): Promise<void> => {
  const { site_public_key, session_id, name, event_data } = req.body;

  if (!site_public_key || !name) {
    res.status(400).json({ error: "Missing required fields: site_public_key or name" });
    return;
  }

  try {
    // Get internal site_id from public_key
    const { rows } = await pool.query("SELECT id FROM sites WHERE public_key = $1", [site_public_key]);

    if (rows.length === 0) {
      res.status(400).json({ error: "Invalid site public key" });
      return;
    }

    const site_id = rows[0].id;

    await pool.query(
      `INSERT INTO events (
        site_id,
        session_id,
        name,
        event_data,
        created_at
      ) VALUES ($1, $2, $3, $4, NOW())`,
      [site_id, session_id || null, name, event_data ? JSON.stringify(event_data) : null]
    );

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("[Event Error]", err);
    res.status(500).json({ error: "Failed to record event" });
  }
});

export default router;
