import { randomUUID } from "crypto";
import { pool } from "../../db";
import { successResponse, errorResponse } from "../../utils/response";
import { assertAuthenticated, authorizeSiteAccess, dayjs, generateSitePublicKey } from "../../utils";

export const siteResolvers = {
  Mutation: {
    addSite: async (_: any, args: any, context: any) => {
      const { domain } = args.input;
      const auth = assertAuthenticated(context);
      if (!auth.success) return auth;
      const userId = auth?.userId;

      if (!domain || typeof domain !== "string" || domain.trim() === "") {
        return errorResponse("Domain is required.");
      } else if (!/^(?!-)[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$/.test(domain)) {
        return errorResponse("Domain is invalid.");
      }

      const cleanedDomain = domain
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "");

      try {
        const existing = await pool.query(`SELECT id FROM sites WHERE user_id = $1 AND domain = $2`, [userId, cleanedDomain]);

        if ((existing?.rowCount || 0) > 0) {
          return errorResponse("This domain is already registered. Please check your dashboard or try a different one.");
        }

        const publicKey = generateSitePublicKey(cleanedDomain);

        const result = await pool.query(
          `INSERT INTO sites (user_id, domain, public_key)
           VALUES ($1, $2, $3)
           RETURNING id, domain, public_key, script_verified, created_at`,
          [userId, cleanedDomain, publicKey]
        );

        const site = result.rows[0];

        return successResponse("Site added successfully", {
          id: site.id,
          domain: site.domain,
          publicKey: site.public_key,
          scriptVerified: site.script_verified,
          createdAt: site.created_at,
        });
      } catch (error) {
        return errorResponse("Something went wrong");
      }
    },
  },

  Query: {
    siteVerificationStatus: async (_: any, args: { siteId: string }, context: any) => {
      const auth = await authorizeSiteAccess(context, args.siteId);
      if (!auth.success) return auth;

      const { siteId } = args;

      try {
        const siteResult = await pool.query(`SELECT * FROM sites WHERE id = $1`, [siteId]);
        const site = siteResult.rows[0];

        if (site.script_verified) {
          return successResponse("Tracking script successfully verified on the correct domain.", {
            id: site.id,
            domain: site.domain,
            publicKey: site.public_key,
            scriptVerified: true,
            createdAt: site.created_at,
          });
        }

        const visitResult = await pool.query(`SELECT DISTINCT url FROM visits WHERE site_id = $1 LIMIT 20`, [siteId]);
        const visits = visitResult.rows;

        if (visits.length === 0) {
          return successResponse("Tracking script not detected yet. It might not be installed, or your site hasn't received any traffic yet.", {
            id: site.id,
            domain: site.domain,
            publicKey: site.public_key,
            scriptVerified: false,
            createdAt: site.created_at,
          });
        }

        const expectedDomain = site.domain;

        const isValid = visits.some((visit) => {
          try {
            const visitDomain = new URL(visit.url).hostname;
            return visitDomain === expectedDomain;
          } catch {
            return false;
          }
        });

        if (isValid) {
          if (!site.script_verified) {
            await pool.query(`UPDATE sites SET script_verified = true WHERE id = $1`, [siteId]);
          }

          return successResponse("Tracking script has been verified and is now active.", {
            id: site.id,
            domain: site.domain,
            publicKey: site.public_key,
            scriptVerified: true,
            createdAt: site.created_at,
          });
        } else {
          return successResponse("Script detected, but installed on a different domain than expected", {
            id: site.id,
            domain: site.domain,
            publicKey: site.public_key,
            scriptVerified: false,
            createdAt: site.created_at,
          });
        }
      } catch (error) {
        return errorResponse("Failed to verify site status");
      }
    },

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
            `SELECT COUNT(DISTINCT visitor_id) AS count
             FROM visits
             WHERE site_id = $1 AND created_at >= $2`,
            [siteId, fiveMinutesAgo]
          ),
          pool.query(
            `SELECT
              COUNT(DISTINCT CASE WHEN created_at >= $2 THEN visitor_id END) AS daily,
              (
                SELECT ROUND(AVG(daily_count)) FROM (
                  SELECT COUNT(DISTINCT visitor_id) AS daily_count
                  FROM visits
                  WHERE site_id = $1 AND created_at >= $3
                  GROUP BY DATE_TRUNC('day', created_at)
                ) AS daily_counts
              ) AS weekly,
              (
                SELECT ROUND(AVG(daily_count)) FROM (
                  SELECT COUNT(DISTINCT visitor_id) AS daily_count
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
        return errorResponse("Failed to fetch live stats.");
      }
    },

    siteKPISummary: async (_: any, args: { siteId: string; startAt: string; endAt: string }, context: any) => {
      const auth = await authorizeSiteAccess(context, args.siteId);
      if (!auth.success) return auth;

      const { siteId, startAt, endAt } = args;

      try {
        const [uniqueVisitorsResult, totalVisitsResult, totalPageviewsResult, viewsPerVisitResult, bounceRateResult, averageDurationResult] =
          await Promise.all([
            pool.query(
              `SELECT COUNT(DISTINCT visitor_id) AS count
            FROM visits
            WHERE site_id = $1 AND created_at BETWEEN $2 AND $3`,
              [siteId, startAt, endAt]
            ),

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
          totalPageviews: parseInt(totalPageviewsResult.rows[0].count || "0"),
          viewsPerVisit: parseFloat(viewsPerVisitResult.rows[0].value || "0"),
          bounceRate: parseFloat(bounceRateResult.rows[0].value || "0"),
          averageVisitDuration: parseFloat(averageDurationResult.rows[0].value || "0"),
        });
      } catch (error) {
        return errorResponse("Failed to fetch site KPI stats.");
      }
    },

    siteTrafficTrends: async (_: any, args: { siteId: string; startAt: string; endAt: string; dateGrouping: "d" | "m" | "y" }, context: any) => {
      const auth = await authorizeSiteAccess(context, args.siteId);
      if (!auth.success)
        return {
          ...auth,
          data: [],
        };

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
            COUNT(DISTINCT visitor_id) AS visitors,
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
        const unit: dayjs.ManipulateType = dateGrouping === "d" ? "day" : dateGrouping === "m" ? "month" : "year";

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
        return successResponse("Traffic trends fetched successfully.", finalData);
      } catch (err) {
        return errorResponse("Failed to fetch traffic trends.", { data: [] });
      }
    },

    siteTopPages: async (_: any, args: { siteId: string; startAt: string; endAt: string }, context: any) => {
      const auth = await authorizeSiteAccess(context, args.siteId);
      if (!auth.success)
        return {
          ...auth,
          data: [],
        };

      const { siteId, startAt, endAt } = args;

      try {
        const result = await pool.query(
          `SELECT 
            url,
            COUNT(*) AS pageviews,
            COUNT(DISTINCT visitor_id) AS visitors
          FROM visits
          WHERE site_id = $1 AND created_at BETWEEN $2 AND $3
          GROUP BY url
          ORDER BY visitors DESC
          LIMIT 20`,
          [siteId, startAt, endAt]
        );

        const finalData = result.rows.map((row) => {
          try {
            const { pathname } = new URL(row.url);
            return {
              source: pathname || "/",
              visitors: Number(row.visitors),
              pageviews: Number(row.pageviews),
            };
          } catch {
            return {
              source: row.url || "/",
              visitors: Number(row.visitors),
              pageviews: Number(row.pageviews),
            };
          }
        });
        return successResponse("Top pages fetched successfully", finalData);
      } catch (error) {
        return errorResponse("Failed to fetch top pages", { data: [] });
      }
    },

    siteTopChannels: async (_: any, args: { siteId: string; startAt: string; endAt: string }, context: any) => {
      const auth = await authorizeSiteAccess(context, args.siteId);
      if (!auth.success)
        return {
          ...auth,
          data: [],
        };
        
      const { siteId, startAt, endAt } = args;

      try {
        const siteResult = await pool.query(`SELECT domain FROM sites WHERE id = $1`, [siteId]);

        const domain = siteResult.rows[0].domain;

        const result = await pool.query(
          `SELECT 
            CASE
              WHEN referrer = '' THEN 'Direct'
              ELSE COALESCE(NULLIF(SPLIT_PART(referrer, '/', 3), ''), 'Direct')
            END AS source,
            COUNT(DISTINCT visitor_id) AS visitors
          FROM visits
          WHERE site_id = $1
            AND created_at BETWEEN $2 AND $3
            AND SPLIT_PART(referrer, '/', 3) IS DISTINCT FROM $4
          GROUP BY source
          ORDER BY visitors DESC
          LIMIT 20`,
          [siteId, startAt, endAt, domain]
        );

        const finalData = result.rows.map((row) => ({
          source: row.source,
          visitors: Number(row.visitors),
        }));

        return successResponse("Top channels fetched successfully.", finalData);
      } catch (error) {
        return errorResponse("Failed to fetch top channels.", { data: [] });
      }
    },

    sessionsByDevice: async (_: any, args: { siteId: string; startAt: string; endAt: string }, context: any) => {
      const auth = await authorizeSiteAccess(context, args.siteId);
      if (!auth.success) return auth;

      const { siteId, startAt, endAt } = args;

      try {
        const result = await pool.query(
          `SELECT 
             device_type,
             COUNT(DISTINCT session_id) AS count
          FROM visits
          WHERE site_id = $1 AND created_at BETWEEN $2 AND $3
          GROUP BY device_type`,
          [siteId, startAt, endAt]
        );

        let desktop = 0;
        let mobile = 0;
        let tablet = 0;
        let total = 0;

        for (const row of result.rows) {
          const type = row.device_type?.toLowerCase();
          const count = Number(row.count);
          total += count;

          if (type === "desktop") desktop += count;
          else if (type === "mobile") mobile += count;
          else if (type === "tablet") tablet += count;
        }

        const getPercentage = (value: number) => (total > 0 ? parseFloat(((value / total) * 100).toFixed(2)) : 0);

        const finalData = {
          desktop: getPercentage(desktop),
          mobile: getPercentage(mobile),
          tablet: getPercentage(tablet),
        };

        return successResponse("Sessions by device (%) fetched successfully.", finalData);
      } catch (error) {
        return errorResponse("Failed to fetch sessions by device.");
      }
    },

    siteAcquisitionChannelsTrends: async (
      _: any,
      args: { siteId: string; startAt: string; endAt: string; dateGrouping: "d" | "m" | "y" },
      context: any
    ) => {
      const auth = await authorizeSiteAccess(context, args.siteId);
      if (!auth.success)
        return {
          ...auth,
          data: [],
        };

      const { siteId, startAt, endAt, dateGrouping } = args;

      const siteResult = await pool.query(`SELECT domain FROM sites WHERE id = $1`, [siteId]);

      const domain = siteResult.rows[0].domain;
      const userDateFormat = context.user?.dateFormat || "DD/MM/YYYY";

      let outputFormat = "YYYY";
      if (dateGrouping === "d") {
        outputFormat = userDateFormat;
      } else if (dateGrouping === "m") {
        outputFormat = userDateFormat.startsWith("YYYY") ? "YYYY/MM" : "MM/YYYY";
      }

      try {
        const result = await pool.query(
          `SELECT 
            TO_CHAR(created_at, $1) AS date_grouping,
            CASE
              WHEN referrer = '' THEN 'direct'
              WHEN SPLIT_PART(referrer, '/', 3) ~* '(google|bing|yahoo|duckduckgo)' THEN 'organic'
              WHEN SPLIT_PART(referrer, '/', 3) ~* '(facebook|instagram|twitter|linkedin|pinterest|reddit|t.co)' THEN 'social'
              ELSE 'referral'
            END AS channel,
            COUNT(DISTINCT session_id) AS visitors
          FROM visits
          WHERE site_id = $2
            AND created_at BETWEEN $3 AND $4
            AND SPLIT_PART(referrer, '/', 3) IS DISTINCT FROM $5
          GROUP BY date_grouping, channel
          ORDER BY date_grouping`,
          [outputFormat, siteId, startAt, endAt, domain]
        );

        const rawData: Record<string, { direct: number; organic: number; social: number; referral: number }> = {};

        result.rows.forEach((row: any) => {
          const dateKey = row.date_grouping;
          const channel = row.channel as "direct" | "organic" | "social" | "referral";
          const count = parseInt(row.visitors, 10);

          if (!rawData[dateKey]) {
            rawData[dateKey] = { direct: 0, organic: 0, social: 0, referral: 0 };
          }
          rawData[dateKey][channel] += count;
        });

        const start = dayjs.utc(startAt);
        const end = dayjs.utc(endAt);
        const unit: dayjs.ManipulateType = dateGrouping === "d" ? "day" : dateGrouping === "m" ? "month" : "year";

        const finalData: {
          dateGrouping: string;
          direct: number;
          organic: number;
          social: number;
          referral: number;
        }[] = [];

        let cursor = start.startOf(unit);

        while (cursor.isSameOrBefore(end, unit)) {
          const key = cursor.format(outputFormat);
          finalData.push({
            dateGrouping: key,
            direct: rawData[key]?.direct || 0,
            organic: rawData[key]?.organic || 0,
            social: rawData[key]?.social || 0,
            referral: rawData[key]?.referral || 0,
          });
          cursor = cursor.add(1, unit);
        }
        return successResponse("Acquisition trends fetched successfully.", finalData);
      } catch (err) {
        return errorResponse("Failed to fetch acquisition trends.", { data: [] });
      }
    },

    visitorShareByCountry: async (_: any, args: { siteId: string; startAt: string; endAt: string }, context: any) => {
      const auth = await authorizeSiteAccess(context, args.siteId);
      if (!auth.success)
        return {
          ...auth,
          data: [],
        };

      const { siteId, startAt, endAt } = args;

      try {
        const result = await pool.query(
          `SELECT country, COUNT(DISTINCT visitor_id) AS count
           FROM visits
           WHERE site_id = $1
             AND created_at BETWEEN $2 AND $3
             AND TRIM(country) <> ''
           GROUP BY country
          `,
          [siteId, startAt, endAt]
        );

        let total = 0;
        const countryCounts: Record<string, number> = {};

        for (const row of result.rows) {
          const country = row.country;
          const count = Number(row.count);
          total += count;
          countryCounts[country] = count;
        }

        const getPercentage = (value: number) => (total > 0 ? parseFloat(((value / total) * 100).toFixed(2)) : 0);

        const finalData = Object.entries(countryCounts).map(([country, count]) => ({
          country,
          percent: getPercentage(count),
        }));
        return successResponse("Visitor share by country (%) fetched successfully.", finalData);
      } catch (error) {
        return errorResponse("Failed to fetch visitor share by country.", { data: [] });
      }
    },
  },
};
