import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../../db";
import { config } from "../../config";
import { successResponse, errorResponse, assertAuthenticated } from "../../utils";

export const userResolvers = {
  Mutation: {
    addUserWithHash: async (_: any, args: any) => {
      const { name, email, password } = args.input;

      if (!name || typeof name !== "string" || name.trim() === "") {
        return errorResponse("Name is required.", null);
      }

      if (!email || typeof email !== "string" || email.trim() === "") {
        return errorResponse("Email is required.", null);
      } else if (!/^\S+@\S+\.\S+$/.test(email)) {
        return errorResponse("Invalid email address.", null);
      }

      if (!password || typeof password !== "string" || password.trim() === "") {
        return errorResponse("Password is required.", null);
      } else if (password.length < 6) {
        return errorResponse("Password must be at least 6 characters.", null);
      } else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
        return errorResponse("Password must contain both letters and numbers.", null);
      }

      try {
        const existing = await pool.query(`SELECT id FROM users WHERE email = $1`, [email]);
        if ((existing?.rowCount ?? 0) > 0) {
          return errorResponse("An account with this email already exists.", null);
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
        return errorResponse(error instanceof Error ? error.message : "Something went wrong", null);
      }
    },

    login: async (_: any, args: any) => {
      const { email, password } = args.input;

      if (!email || typeof email !== "string" || email.trim() === "") {
        return errorResponse("Email is required.", null);
      } else if (!/^\S+@\S+\.\S+$/.test(email)) {
        return errorResponse("Invalid email address.", null);
      }

      if (!password || typeof password !== "string" || password.trim() === "") {
        return errorResponse("Password is required.", null);
      } else if (password.length < 6) {
        return errorResponse("Password must be at least 6 characters.", null);
      } else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
        return errorResponse("Password must contain both letters and numbers.", null);
      }

      try {
        const result = await pool.query(
          `SELECT id, name, email, password_hash, timezone, date_format, pref_set FROM users WHERE email = $1`,
          [email]
        );

        const user = result.rows[0];
        if (!user) {
          return errorResponse(
            "No account found with this email. Please check and try again.",
            null
          );
        }

        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
          return errorResponse("The password you entered is incorrect. Please try again.", null);
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
        return errorResponse(error instanceof Error ? error.message : "Something went wrong", null);
      }
    },
    
    addUserPreferences: async (_: any, args: any, context: any) => {
      const { timezone, dateFormat } = args.input;

      const auth = assertAuthenticated(context);
      if (!auth.success) return auth;
      const userId = auth?.userId;

      if (!timezone || !Intl.supportedValuesOf("timeZone").includes(timezone)) {
        return errorResponse("Invalid or missing timezone", null);
      }

      const validFormats = ["YYYY/MM/DD", "MM/DD/YYYY", "DD/MM/YYYY"];
      if (!dateFormat || !validFormats.includes(dateFormat)) {
        return errorResponse("Invalid or missing date format", null);
      }

      try {
        await pool.query(
          `UPDATE users
           SET timezone = $1, date_format = $2, pref_set = true
           WHERE id = $3`,
          [timezone, dateFormat, userId]
        );

        const result = await pool.query(
          `SELECT name, email, timezone, date_format, pref_set
           FROM users
           WHERE id = $1`,
          [userId]
        );

        const user = result.rows[0];

        return successResponse("Preferences saved successfully", {
          name: user.name,
          email: user.email,
          timezone: user.timezone,
          dateFormat: user.date_format,
          prefSet: user.pref_set,
        });
      } catch (error) {
        return errorResponse(error instanceof Error ? error.message : "Something went wrong", null);
      }
    },
  },
};
