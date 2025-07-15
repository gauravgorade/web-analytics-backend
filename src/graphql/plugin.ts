import { makeExtendSchemaPlugin } from "postgraphile";
import { userTypeDefs, siteTypeDefs, commonTypes } from "./typeDefs";
import { userResolvers, siteResolvers } from "./resolvers";

export const customPlugin = makeExtendSchemaPlugin(() => ({
  typeDefs: [commonTypes, userTypeDefs, siteTypeDefs],
  resolvers: {
    Query: {
      ...siteResolvers.Query,
    },
    Mutation: {
      ...userResolvers.Mutation,
      ...siteResolvers.Mutation,
    },
  },
}));
