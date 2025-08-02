import { postgraphile } from "postgraphile";
import { GraphQLError } from "graphql";
import { config } from "./config";
import { getUserById, getUserIdFromRequest } from "./utils";
import { customPlugin } from "./graphql/plugin";

export const postgraphileMiddleware = postgraphile(config.DATABASE_URL, "public", {
  graphqlRoute: "/v1/api/web-analytics-api",
  graphiqlRoute: "/v1/api/web-analytics-api-i",
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
    if (!userId) return {};

    const user = await getUserById(userId);
    if (!user) return {};

    return {
      "jwt.claims.user_id": user.id,
      "jwt.claims.user_name": user.name ?? "",
      "jwt.claims.user_email": user.email ?? "",
      "jwt.claims.timezone": user.timezone ?? "UTC",
      "jwt.claims.date_format": user.dateFormat ?? "DD-MM-YYYY",
    };
  },
  additionalGraphQLContextFromRequest: async (req) => {
    const userId = getUserIdFromRequest(req);
    if (!userId) return {};

    const user = await getUserById(userId);
    return { userId, user };
  },
});
