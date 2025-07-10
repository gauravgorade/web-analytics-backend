"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const useragent_1 = __importDefault(require("useragent"));
const geoip_lite_1 = __importDefault(require("geoip-lite"));
const router = (0, express_1.Router)();
router.post("/", async (req, res) => {
    const { site_public_key, session_id, url, referrer, user_agent, device_type } = req.body;
    if (!site_public_key || !url) {
        res.status(400).json({ error: "Missing required fields" });
        return;
    }
    const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.socket.remoteAddress || "";
    const geo = geoip_lite_1.default.lookup(ip);
    const ua = useragent_1.default.parse(user_agent || "");
    try {
        const { rows } = await db_1.pool.query("SELECT id FROM sites WHERE public_key = $1", [site_public_key]);
        if (rows.length === 0) {
            res.status(400).json({ error: "Invalid site public key" });
            return;
        }
        const site_id = rows[0].id;
        await db_1.pool.query(`INSERT INTO visits (
        site_id,
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
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())`, [site_id, session_id || null, url, referrer || null, user_agent || null, device_type || null, geo?.country || null, geo?.region || null, geo?.city || null, ua.os.toString(), ua.toAgent()]);
        res.status(200).json({ success: true });
    }
    catch (err) {
        console.error("[Collect Error]", err);
        res.status(500).json({ error: "Failed to collect visit data" });
    }
});
exports.default = router;
