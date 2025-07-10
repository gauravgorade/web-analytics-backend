import { postgraphile } from "postgraphile";
import { GraphQLError } from "graphql";
import { config } from "./config";
import { getUserIdFromRequest } from "./utils";
import { customPlugin } from "./graphql/plugin";

export const postgraphileMiddleware = postgraphile(config.DATABASE_URL, "public", {
  graphqlRoute: "/v1/api/putler-analytics-api",
  graphiqlRoute: "/v1/api/putler-analytics-api-i",
  graphiql: true,
  enhanceGraphiql: true,
  dynamicJson: true,
  appendPlugins: [customPlugin],
  handleErrors: (errors, _req, _res) => {
    return errors.map((err) => {
      return new GraphQLError(err.message, err.nodes, err.source, err.positions, err.path);
    });
  },
  pgSettings: async (req) => {
    const userId = getUserIdFromRequest(req);
    return userId ? { "jwt.claims.user_id": userId } : {};
  },
  additionalGraphQLContextFromRequest: async (req) => {
    const userId = getUserIdFromRequest(req);
    return { userId };
  },
});
