import { makeExtendSchemaPlugin } from "postgraphile";
import { userTypeDefs, siteTypeDefs } from "./typeDefs";
import { userResolvers, siteResolvers } from "./resolvers";

export const customPlugin = makeExtendSchemaPlugin(() => ({
  typeDefs: [userTypeDefs,siteTypeDefs],
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