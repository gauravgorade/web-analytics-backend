"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userResolvers = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = require("../../db");
const config_1 = require("../../config");
exports.userResolvers = {
    Mutation: {
        createUserWithHash: async (_query, args) => {
            const { name, email, password } = args.input;
            try {
                const existing = await db_1.pool.query(`SELECT id FROM users WHERE email = $1`, [email]);
                if (existing.rows.length > 0) {
                    return {
                        success: false,
                        message: "Email already exists",
                        user: null,
                    };
                }
                const passwordHash = await bcryptjs_1.default.hash(password, 10);
                const result = await db_1.pool.query(`INSERT INTO users (name, email, password_hash)
           VALUES ($1, $2, $3)
           RETURNING name, email, timezone, date_format`, [name, email, passwordHash]);
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
            }
            catch (error) {
                return {
                    success: false,
                    message: error instanceof Error ? error.message : "Something went wrong",
                    user: null,
                };
            }
        },
        login: async (_query, args) => {
            const { email, password } = args.input;
            try {
                const result = await db_1.pool.query(`SELECT id, name, email, password_hash, timezone, date_format FROM users WHERE email = $1`, [email]);
                const user = result.rows[0];
                if (!user) {
                    return {
                        success: false,
                        message: "Invalid credentials",
                        token: "",
                        user: null,
                    };
                }
                const isValid = await bcryptjs_1.default.compare(password, user.password_hash);
                if (!isValid) {
                    return {
                        success: false,
                        message: "Invalid credentials",
                        token: "",
                        user: null,
                    };
                }
                const siteRes = await db_1.pool.query(`SELECT id, domain, public_key, created_at FROM sites WHERE user_id = $1`, [user.id]);
                const sites = siteRes.rows.map((site) => ({
                    id: site.id,
                    domain: site.domain,
                    publicKey: site.public_key,
                    createdAt: site.created_at,
                }));
                const token = jsonwebtoken_1.default.sign({ userId: user.id, email: user.email }, config_1.config.JWT_SECRET, {
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
            }
            catch (error) {
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
