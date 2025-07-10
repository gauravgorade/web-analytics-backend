import { makeExtendSchemaPlugin } from "postgraphile";
import { userTypeDefs, siteTypeDefs } from "./typeDefs";
import { userResolvers, siteResolvers } from "./resolvers";

export const customPlugin = makeExtendSchemaPlugin(() => ({
  typeDefs: [userTypeDefs,siteTypeDefs],
  resolvers: {
    Mutation: {
      ...userResolvers.Mutation,
      ...siteResolvers.Mutation,
    },
  },
}));