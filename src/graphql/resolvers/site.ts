import { randomUUID } from "crypto";
import { pool } from "../../db";
import { successResponse, errorResponse } from "../../utils/response";
import { assertAuthenticated, assertUserOwnsSite } from "../../utils";

export const siteResolvers = {
  Mutation: {
    addSite: async (_: any, args: any, context: any) => {
      const { domain } = args.input;
      const auth = assertAuthenticated(context);
      if (!auth.success) return auth;
      const userId = auth?.userId;

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
      context: any
    ) => {
      const auth = assertAuthenticated(context);
      if (!auth.success) return auth;

      const privilegeCheck = await assertUserOwnsSite(auth.userId, args.siteId);
      if (!privilegeCheck.success) return privilegeCheck;

      const { siteId, startAt, endAt } = args;

      try {
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

    siteLiveStats: async (_: any, args: { siteId: string }, context: any) => {
      const auth = assertAuthenticated(context);
      if (!auth.success) return auth;

      const privilegeCheck = await assertUserOwnsSite(auth.userId, args.siteId);
      if (!privilegeCheck.success) return privilegeCheck;

      const { siteId } = args;

      try {
        const now = new Date();
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();

        const startOfDay = new Date(now);
        startOfDay.setUTCHours(0, 0, 0, 0);

        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setUTCDate(now.getUTCDate() - 30);

        const [liveUsersResult, activePagesResult, liveEventsResult, avgUsersResult] =
          await Promise.all([
            pool.query(
              `SELECT COUNT(DISTINCT session_id) AS count
           FROM visits
           WHERE site_id = $1 AND created_at >= $2`,
              [siteId, fiveMinutesAgo]
            ),
            pool.query(
              `SELECT url AS path, COUNT(*) AS count
           FROM visits
           WHERE site_id = $1 AND created_at >= $2
           GROUP BY url
           ORDER BY count DESC
           LIMIT 10`,
              [siteId, fiveMinutesAgo]
            ),
            pool.query(
              `SELECT name, COUNT(*) AS count
           FROM events
           WHERE site_id = $1 AND created_at >= $2
           GROUP BY name
           ORDER BY count DESC
           LIMIT 10`,
              [siteId, fiveMinutesAgo]
            ),
            pool.query(
              `SELECT
              COUNT(DISTINCT CASE WHEN created_at >= CURRENT_DATE - INTERVAL '1 day' THEN session_id END) AS daily,
              COUNT(DISTINCT CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN session_id END) / 7 AS weekly,
              COUNT(DISTINCT CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN session_id END) / 30 AS monthly
           FROM visits
           WHERE site_id = $1`,
              [siteId]
            ),
          ]);

        const avg = avgUsersResult.rows[0];

        return successResponse("Live site stats fetched", {
          liveUsers: parseInt(liveUsersResult.rows[0].count || "0"),
          activePages: activePagesResult.rows.map((row) => ({
            path: row.path,
            count: parseInt(row.count),
          })),
          liveEvents: liveEventsResult.rows.map((row) => ({
            name: row.name,
            count: parseInt(row.count),
          })),
          avgDailyUsers: Math.round(avg.daily || 0),
          avgWeeklyUsers: Math.round(avg.weekly || 0),
          avgMonthlyUsers: Math.round(avg.monthly || 0),
        });
      } catch (error) {
        console.error("Error in siteLiveStats:", error);
        return errorResponse("Failed to fetch live stats.", { data: null });
      }
    },
  },
};
