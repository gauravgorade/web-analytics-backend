"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.siteResolvers = void 0;
const crypto_1 = require("crypto");
const db_1 = require("../../db");
exports.siteResolvers = {
    Mutation: {
        addSite: async (_query, args, context) => {
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
                const existing = await db_1.pool.query(`SELECT id, domain, public_key, created_at FROM sites WHERE user_id = $1 AND domain = $2`, [userId, cleanedDomain]);
                if ((existing?.rowCount ?? 0) > 0) {
                    return {
                        success: false,
                        message: "This domain is already registered. Please check your dashboard or try a different one.",
                        site: null,
                    };
                }
                const cleanDomainForKey = cleanedDomain.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
                const uniquePart = (0, crypto_1.randomUUID)().split("-")[0];
                const publicKey = `PUTLERA-${cleanDomainForKey}-${uniquePart}`;
                const result = await db_1.pool.query(`INSERT INTO sites (user_id, domain, public_key)
          VALUES ($1, $2, $3)
          RETURNING id, domain, public_key, created_at`, [userId, cleanedDomain, publicKey]);
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
            }
            catch (error) {
                return {
                    success: false,
                    message: error instanceof Error ? error.message : "Something went wrong",
                    site: null,
                };
            }
        },
    },
};
