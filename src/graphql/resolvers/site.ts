import { randomUUID } from "crypto";
import { pool } from "../../db";
import { successResponse, errorResponse } from "../../utils/response";
import { assertAuthenticated, assertUserOwnsSite, authorizeSiteAccess, dayjs } from "../../utils";

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
    siteLiveStats: async (_: any, args: { siteId: string }, context: any) => {
      const auth = await authorizeSiteAccess(context, args.siteId);
      if (!auth.success) return auth;

      const { siteId } = args;

      try {
        const userTimezone = context.user?.timezone || "UTC";

        const now = dayjs().tz(userTimezone);
        const fiveMinutesAgo = now.subtract(5, "minute").utc().toISOString();

        const startOfToday = now.startOf("day").utc().toISOString();
        const startOf7DaysAgo = now.subtract(7, "days").startOf("day").utc().toISOString();
        const startOf30DaysAgo = now.subtract(30, "days").startOf("day").utc().toISOString();

        const [liveUsersResult, avgUsersResult] = await Promise.all([
          pool.query(
            `SELECT COUNT(DISTINCT session_id) AS count
         FROM visits
         WHERE site_id = $1 AND created_at >= $2`,
            [siteId, fiveMinutesAgo]
          ),
          pool.query(
            `SELECT
          COUNT(DISTINCT CASE WHEN created_at >= $2 THEN session_id END) AS daily,
          (
            SELECT AVG(day_count) FROM (
              SELECT COUNT(DISTINCT session_id) AS day_count
              FROM visits
              WHERE site_id = $1 AND created_at >= $3
              GROUP BY DATE_TRUNC('day', created_at)
            ) AS daily_counts
          ) AS weekly,
          (
            SELECT AVG(day_count) FROM (
              SELECT COUNT(DISTINCT session_id) AS day_count
              FROM visits
              WHERE site_id = $1 AND created_at >= $4
              GROUP BY DATE_TRUNC('day', created_at)
            ) AS daily_counts
          ) AS monthly
        FROM visits
        WHERE site_id = $1`,
            [siteId, startOfToday, startOf7DaysAgo, startOf30DaysAgo]
          ),
        ]);

        const avg = avgUsersResult.rows[0] || {};

        return successResponse("Live site stats fetched", {
          liveUsers: parseInt(liveUsersResult.rows[0]?.count || "0"),
          avgDailyUsers: Math.round(avg.daily || 0),
          avgWeeklyUsers: Math.round(avg.weekly || 0),
          avgMonthlyUsers: Math.round(avg.monthly || 0),
        });
      } catch (error) {
        console.error("Error in siteLiveStats:", error);
        return errorResponse("Failed to fetch live stats.", { data: null });
      }
    },

    siteKPISummary: async (
      _: any,
      args: { siteId: string; startAt: string; endAt: string },
      context: any
    ) => {
      const auth = await authorizeSiteAccess(context, args.siteId);
      if (!auth.success) return auth;

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

    siteTrafficTrends: async (
      _: any,
      args: { siteId: string; startAt: string; endAt: string; dateGrouping: "d" | "m" | "y" },
      context: any
    ) => {
      const auth = await authorizeSiteAccess(context, args.siteId);
      if (!auth.success) {
        return {
          ...auth,
          data: [],
        };
      }

      const { siteId, startAt, endAt, dateGrouping } = args;

      const userDateFormat = context.user?.dateFormat || "DD/MM/YYYY";

      let outputFormat = "YYYY";
      if (dateGrouping === "d") {
        outputFormat = userDateFormat;
      } else if (dateGrouping === "m") {
        if (userDateFormat.startsWith("YYYY")) {
          outputFormat = "YYYY/MM";
        } else {
          outputFormat = "MM/YYYY";
        }
      }

      try {
        const result = await pool.query(
          `SELECT 
            TO_CHAR(created_at, $1) AS date_grouping,
            COUNT(DISTINCT session_id) AS visitors,
            COUNT(url) AS pageviews
          FROM visits
          WHERE site_id = $2 AND created_at BETWEEN $3 AND $4
          GROUP BY date_grouping
          ORDER BY date_grouping ASC`,
          [outputFormat, siteId, startAt, endAt]
        );

        const rawData: Record<string, { visitors: number; pageviews: number }> = {};
        result.rows.forEach((row: any) => {
          rawData[row.date_grouping] = {
            visitors: parseInt(row.visitors, 10),
            pageviews: parseInt(row.pageviews, 10),
          };
        });

        const start = dayjs.utc(startAt);
        const end = dayjs.utc(endAt);
        const unit: dayjs.ManipulateType =
          dateGrouping === "d" ? "day" : dateGrouping === "m" ? "month" : "year";

        const finalData: {
          dateGrouping: string;
          visitors: number;
          pageviews: number;
        }[] = [];

        let cursor = start.startOf(unit);

        while (cursor.isSameOrBefore(end, unit)) {
          const key = cursor.format(outputFormat);
          finalData.push({
            dateGrouping: key,
            visitors: rawData[key]?.visitors || 0,
            pageviews: rawData[key]?.pageviews || 0,
          });
          cursor = cursor.add(1, unit);
        }

        return {
          success: true,
          message: "Traffic stats fetched successfully.",
          data: finalData,
        };
      } catch (err) {
        console.error("Error in siteTrafficStats:", err);
        return {
          success: false,
          message: "Failed to fetch traffic stats.",
          data: [],
        };
      }
    },

    siteTopPages: async (
      _: any,
      args: { siteId: string; startAt: string; endAt: string },
      context: any
    ) => {
      const auth = await authorizeSiteAccess(context, args.siteId);
      if (!auth.success) {
        return {
          ...auth,
          data: [],
        };
      }

      const { siteId, startAt, endAt } = args;

      try {
        const result = await pool.query(
          `SELECT 
            url,
            COUNT(DISTINCT session_id) AS visitors
          FROM visits
          WHERE site_id = $1 AND created_at BETWEEN $2 AND $3
          GROUP BY url
          ORDER BY visitors DESC
          LIMIT 20`,
          [siteId, startAt, endAt]
        );

        const data = result.rows.map((row) => {
          try {
            const { pathname } = new URL(row.url);
            return {
              source: pathname || "/",
              visitors: Number(row.visitors),
            };
          } catch {
            return {
              source: row.url || "/",
              visitors: Number(row.visitors),
            };
          }
        });

        return {
          success: true,
          message: "Top pages fetched successfully",
          data,
        };
      } catch (error) {
        console.error("Error in siteTopPages:", error);
        return {
          success: false,
          message: "Failed to fetch top pages",
          data: [],
        };
      }
    },

    siteTopChannels: async (
      _: any,
      args: { siteId: string; startAt: string; endAt: string },
      context: any
    ) => {
      try {
        const auth = await authorizeSiteAccess(context, args.siteId);
        if (!auth.success) {
          return {
            ...auth,
            data: [],
          };
        }

        const { siteId, startAt, endAt } = args;

        const result = await pool.query(
          `SELECT 
            COALESCE(NULLIF(SPLIT_PART(referrer, '/', 3), ''), 'Direct') AS source,
            COUNT(DISTINCT session_id) AS visitors
          FROM visits
          WHERE site_id = $1
            AND created_at BETWEEN $2 AND $3
          GROUP BY source
          ORDER BY visitors DESC
          LIMIT 20`,
          [siteId, startAt, endAt]
        );

        return {
          success: true,
          message: "Top channels fetched successfully.",
          data: result.rows.map((row) => ({
            source: row.source,
            visitors: Number(row.visitors),
          })),
        };
      } catch (error) {
        console.error("Error in siteTopChannels:", error);
        return {
          success: false,
          message: "Failed to fetch top channels.",
          data: [],
        };
      }
    },
  },
};
