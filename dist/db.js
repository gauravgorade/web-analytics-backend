"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
const pg_1 = require("pg");
const config_1 = require("./config");
exports.pool = new pg_1.Pool({
    connectionString: config_1.config.DATABASE_URL,
});
exports.pool
    .connect()
    .then(() => console.log("Connected to PostgreSQL"))
    .catch((err) => {
    console.error("Failed to connect to PostgreSQL:", err);
    process.exit(1);
});
