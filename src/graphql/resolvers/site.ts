import { randomUUID } from "crypto";
import { pool } from "../../db";
import { successResponse, errorResponse } from "../../utils/response";

export const siteResolvers = {
  Mutation: {
    addSite: async (_: any, args: any, context: any) => {
      const { domain } = args.input;
      const userId = context.userId;

      if (!userId) {
        return errorResponse("Unauthorized", { site: null });
      }

      const cleanedDomain = domain
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "");

      try {
        const existing = await pool.query(
          `SELECT id FROM sites WHERE user_id = $1 AND domain = $2`,
          [userId, cleanedDomain]
        );

        if ((existing?.rowCount || 0) > 0) {
          return errorResponse(
            "This domain is already registered. Please check your dashboard or try a different one.",
            { site: null }
          );
        }

        const cleanDomainForKey = cleanedDomain.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
        const uniquePart = randomUUID().split("-")[0];
        const publicKey = `PUTLERA-${cleanDomainForKey}-${uniquePart}`;

        const result = await pool.query(
          `INSERT INTO sites (user_id, domain, public_key)
           VALUES ($1, $2, $3)
           RETURNING id, domain, public_key, created_at`,
          [userId, cleanedDomain, publicKey]
        );

        const site = result.rows[0];

        return successResponse("Site added successfully", {
          id: site.id,
          domain: site.domain,
          publicKey: site.public_key,
          createdAt: site.created_at,
        });
      } catch (error) {
        return errorResponse(error instanceof Error ? error.message : "Something went wrong", {
          site: null,
        });
      }
    },
  },

  Query: {
    siteKPIStats: async (
      _: any,
      args: { siteId: string; startAt: string; endAt: string },
      context: { userId?: string }
    ) => {
      const { siteId, startAt, endAt } = args;
      const userId = context.userId;

      if (!userId) {
        return errorResponse("Unauthorized", { data: null });
      }

      try {
        const siteCheck = await pool.query(`SELECT 1 FROM sites WHERE id = $1 AND user_id = $2`, [
          siteId,
          userId,
        ]);

        if ((siteCheck?.rowCount || 0) === 0) {
          return errorResponse("Unauthorized: Site does not belong to user.", { data: null });
        }

        const [
          uniqueVisitorsResult,
          totalVisitsResult,
          viewsPerVisitResult,
          bounceRateResult,
          averageDurationResult,
        ] = await Promise.all([
          pool.query(
            `SELECT COUNT(DISTINCT session_id) AS count
         FROM visits
         WHERE site_id = $1 AND created_at BETWEEN $2 AND $3`,
            [siteId, startAt, endAt]
          ),
          pool.query(
            `SELECT COUNT(*) AS count
         FROM visits
         WHERE site_id = $1 AND created_at BETWEEN $2 AND $3`,
            [siteId, startAt, endAt]
          ),
          pool.query(
            `SELECT CASE
           WHEN COUNT(DISTINCT session_id) = 0 THEN 0
           ELSE COUNT(*) * 1.0 / COUNT(DISTINCT session_id)
         END AS value
         FROM visits
         WHERE site_id = $1 AND created_at BETWEEN $2 AND $3`,
            [siteId, startAt, endAt]
          ),
          pool.query(
            `SELECT CASE
           WHEN COUNT(*) = 0 THEN 0
           ELSE COUNT(*) FILTER (WHERE visit_count = 1) * 1.0 / COUNT(*)
         END AS value
         FROM (
           SELECT session_id, COUNT(*) AS visit_count
           FROM visits
           WHERE site_id = $1 AND created_at BETWEEN $2 AND $3
           GROUP BY session_id
         ) sub`,
            [siteId, startAt, endAt]
          ),
          pool.query(
            `SELECT AVG(EXTRACT(EPOCH FROM max_time - min_time)) AS value
         FROM (
           SELECT MIN(created_at) AS min_time, MAX(created_at) AS max_time
           FROM visits
           WHERE site_id = $1 AND created_at BETWEEN $2 AND $3
           GROUP BY session_id
         ) sub`,
            [siteId, startAt, endAt]
          ),
        ]);

        return successResponse("Site KPI stats fetched", {
          uniqueVisitors: parseInt(uniqueVisitorsResult.rows[0].count || "0"),
          totalVisits: parseInt(totalVisitsResult.rows[0].count || "0"),
          totalPageviews: parseInt(totalVisitsResult.rows[0].count || "0"),
          viewsPerVisit: parseFloat(viewsPerVisitResult.rows[0].value || "0"),
          bounceRate: parseFloat(bounceRateResult.rows[0].value || "0"),
          averageVisitDuration: parseFloat(averageDurationResult.rows[0].value || "0"),
        });
      } catch (error) {
        console.error("Error in siteKPIStats:", error);
        return errorResponse("Failed to fetch site KPI stats.", { data: null });
      }
    },
  },
};
