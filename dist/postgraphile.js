"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postgraphileMiddleware = void 0;
const postgraphile_1 = require("postgraphile");
const graphql_1 = require("graphql");
const config_1 = require("./config");
const utils_1 = require("./utils");
const plugin_1 = require("./graphql/plugin");
exports.postgraphileMiddleware = (0, postgraphile_1.postgraphile)(config_1.config.DATABASE_URL, "public", {
    graphqlRoute: "/v1/api/putler-analytics-api",
    graphiqlRoute: "/v1/api/putler-analytics-api-i",
    graphiql: true,
    enhanceGraphiql: true,
    dynamicJson: true,
    appendPlugins: [plugin_1.customPlugin],
    handleErrors: (errors, _req, _res) => {
        return errors.map((err) => {
            return new graphql_1.GraphQLError(err.message, err.nodes, err.source, err.positions, err.path);
        });
    },
    pgSettings: async (req) => {
        const userId = (0, utils_1.getUserIdFromRequest)(req);
        return userId ? { "jwt.claims.user_id": userId } : {};
    },
    additionalGraphQLContextFromRequest: async (req) => {
        const userId = (0, utils_1.getUserIdFromRequest)(req);
        return { userId };
    },
});
