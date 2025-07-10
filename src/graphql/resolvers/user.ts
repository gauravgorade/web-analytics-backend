import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../../db";
import { config } from "../../config";

export const userResolvers = {
  Mutation: {
    createUserWithHash: async (_query: any, args: any) => {
      const { name, email, password } = args.input;

      try {
        const existing = await pool.query(`SELECT id FROM users WHERE email = $1`, [email]);
        if (existing.rows.length > 0) {
          return {
            success: false,
            message: "Email already exists",
            user: null,
          };
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const result = await pool.query(
          `INSERT INTO users (name, email, password_hash)
           VALUES ($1, $2, $3)
           RETURNING name, email, timezone, date_format`,
          [name, email, passwordHash]
        );

        const user = {
          name: result.rows[0].name,
          email: result.rows[0].email,
          timezone: result.rows[0].timezone,
          dateFormat: result.rows[0].date_format,
        };

        return {
          success: true,
          message: "User created successfully",
          user,
        };
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : "Something went wrong",
          user: null,
        };
      }
    },

    login: async (_query: any, args: any) => {
      const { email, password } = args.input;

      try {
        const result = await pool.query(
          `SELECT id, name, email, password_hash, timezone, date_format FROM users WHERE email = $1`,
          [email]
        );

        const user = result.rows[0];
        if (!user) {
          return {
            success: false,
            message: "Invalid credentials",
            token: "",
            user: null,
          };
        }

        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
          return {
            success: false,
            message: "Invalid credentials",
            token: "",
            user: null,
          };
        }

        const siteRes = await pool.query(
          `SELECT id, domain, public_key, created_at FROM sites WHERE user_id = $1`,
          [user.id]
        );

        const sites = siteRes.rows.map((site: any) => ({
          id: site.id,
          domain: site.domain,
          publicKey: site.public_key,
          createdAt: site.created_at,
        }));

        const token = jwt.sign({ userId: user.id, email: user.email }, config.JWT_SECRET, {
          expiresIn: "7d",
        });

        return {
          success: true,
          message: "Login successful",
          token,
          user: {
            name: user.name,
            email: user.email,
            timezone: user.timezone,
            dateFormat: user.date_format,
            sites,
          },
        };
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : "Something went wrong",
          token: "",
          user: null,
        };
      }
    },
  },
};

