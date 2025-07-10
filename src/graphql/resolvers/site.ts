import { randomUUID } from "crypto";
import { pool } from "../../db";

export const siteResolvers = {
  Mutation: {
    addSite: async (_query: any, args: any, context: any) => {
      const { domain } = args.input;
      const userId = context.userId;

      if (!userId) {
        return {
          success: false,
          message: "Unauthorized",
          site: null,
        };
      }

      const cleanedDomain = domain
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "");

      try {
        // Check if site already exists for the user
        const existing = await pool.query(
          `SELECT id, domain, public_key, created_at FROM sites WHERE user_id = $1 AND domain = $2`,
          [userId, cleanedDomain]
        );

        if ((existing?.rowCount ?? 0) > 0) {
          return {
            success: false,
            message:
              "This domain is already registered. Please check your dashboard or try a different one.",
            site: null,
          };
        }

        // Generate new public key
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

        return {
          success: true,
          message: "Site added successfully",
          site: {
            id: site.id,
            domain: site.domain,
            publicKey: site.public_key,
            createdAt: site.created_at,
          },
        };
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : "Something went wrong",
          site: null,
        };
      }
    },
  },
  Query: {
    siteKPIStats: async (_: any, args: { siteId: string }) => {
      const { siteId } = args;

      try {
        const [
          uniqueVisitorsResult,
          totalVisitsResult,
          viewsPerVisitResult,
          bounceRateResult,
          averageDurationResult,
        ] = await Promise.all([
          pool.query(`SELECT COUNT(DISTINCT session_id) AS count FROM visits WHERE site_id = $1`, [
            siteId,
          ]),
          pool.query(`SELECT COUNT(*) AS count FROM visits WHERE site_id = $1`, [siteId]),
          pool.query(
            `
            SELECT COUNT(*) * 1.0 / COUNT(DISTINCT session_id) AS value
            FROM visits WHERE site_id = $1
          `,
            [siteId]
          ),
          pool.query(
            `
            SELECT COUNT(*) FILTER (WHERE visit_count = 1) * 1.0 / COUNT(*) AS value
            FROM (
              SELECT session_id, COUNT(*) AS visit_count
              FROM visits WHERE site_id = $1
              GROUP BY session_id
            ) sub
          `,
            [siteId]
          ),
          pool.query(
            `
            SELECT AVG(EXTRACT(EPOCH FROM max_time - min_time)) AS value
            FROM (
              SELECT MIN(created_at) AS min_time, MAX(created_at) AS max_time
              FROM visits WHERE site_id = $1
              GROUP BY session_id
            ) sub
          `,
            [siteId]
          ),
        ]);

        return {
          uniqueVisitors: parseInt(uniqueVisitorsResult.rows[0].count || "0"),
          totalVisits: parseInt(totalVisitsResult.rows[0].count || "0"),
          totalPageviews: parseInt(totalVisitsResult.rows[0].count || "0"), 
          viewsPerVisit: parseFloat(viewsPerVisitResult.rows[0].value || "0"),
          bounceRate: parseFloat(bounceRateResult.rows[0].value || "0"),
          averageVisitDuration: parseFloat(averageDurationResult.rows[0].value || "0"),
        };
      } catch (error) {
        console.error("Error in siteKPIStats:", error);
        throw new Error("Failed to fetch site KPI stats.");
      }
    },
  },
};
