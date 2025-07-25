import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../../db";
import { config } from "../../config";
import { successResponse, errorResponse } from "../../utils";

export const userResolvers = {
  Mutation: {
    addUserWithHash: async (_: any, args: any) => {
      const { name, email, password } = args.input;

      try {
        const existing = await pool.query(`SELECT id FROM users WHERE email = $1`, [email]);
        if ((existing?.rowCount ?? 0) > 0) {
          return errorResponse("Email already exists", null);
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const result = await pool.query(
          `INSERT INTO users (name, email, password_hash)
           VALUES ($1, $2, $3)
           RETURNING name, email, timezone, date_format, pref_set`,
          [name, email, passwordHash]
        );

        const user = {
          name: result.rows[0].name,
          email: result.rows[0].email,
          timezone: result.rows[0].timezone,
          dateFormat: result.rows[0].date_format,
          prefSet: result.rows[0].pref_set,
        };

        return successResponse("User created successfully", user);
      } catch (error) {
        return errorResponse(
          error instanceof Error ? error.message : "Something went wrong",
          null
        );
      }
    },

    login: async (_: any, args: any) => {
      const { email, password } = args.input;

      try {
        const result = await pool.query(
          `SELECT id, name, email, password_hash, timezone, date_format, pref_set FROM users WHERE email = $1`,
          [email]
        );

        const user = result.rows[0];
        if (!user) {
          return errorResponse("Invalid credentials", null);
        }

        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
          return errorResponse("Invalid credentials", null);
        }

        const siteRes = await pool.query(
          `SELECT id, domain, public_key, script_verified, created_at FROM sites WHERE user_id = $1`,
          [user.id]
        );

        const sites = siteRes.rows.map((site: any) => ({
          id: site.id,
          domain: site.domain,
          publicKey: site.public_key,
          scriptVerified: site.script_verified,
          createdAt: site.created_at,
        }));

        const token = jwt.sign({ userId: user.id, email: user.email }, config.JWT_SECRET, {
          expiresIn: "7d",
        });

        return successResponse("Login successful", {
          token,
          user: {
            name: user.name,
            email: user.email,
            timezone: user.timezone,
            dateFormat: user.date_format,
            prefSet: user.pref_set,
            sites,
          },
        });
      } catch (error) {
        return errorResponse(
          error instanceof Error ? error.message : "Something went wrong",
          null
        );
      }
    },
  },
};
