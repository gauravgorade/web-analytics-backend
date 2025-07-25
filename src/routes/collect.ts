import { Router, Request, Response } from "express";
import { pool } from "../db";
import useragent from "useragent";
import geoip from "geoip-lite";

const router = Router();

router.post("/", async (req: Request, res: Response): Promise<void> => {
  const { site_public_key, visitor_id,session_id, url, referrer, user_agent, device_type } = req.body;

  if (!site_public_key || !url) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() || req.socket.remoteAddress || "";

  const geo = geoip.lookup(ip);
  const ua = useragent.parse(user_agent || "");

  try {
    const { rows } = await pool.query("SELECT id FROM sites WHERE public_key = $1", [site_public_key]);

    if (rows.length === 0) {
      res.status(400).json({ error: "Invalid site public key" });
      return;
    }

    const site_id = rows[0].id;

    await pool.query(
      `INSERT INTO visits (
        site_id,
        visitor_id,
        session_id,
        url,
        referrer,
        user_agent,
        device_type,
        country,
        region,
        city,
        os,
        browser,
        created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())`,
      [site_id, visitor_id, session_id, url, referrer, user_agent, device_type, geo?.country, geo?.region, geo?.city, ua.os.toString(), ua.toAgent()]
    );

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("[Collect Error]", err);
    res.status(500).json({ error: "Failed to collect visit data" });
  }
});

export default router;
