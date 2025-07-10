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
};
