"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.customPlugin = void 0;
const postgraphile_1 = require("postgraphile");
const typeDefs_1 = require("./typeDefs");
const resolvers_1 = require("./resolvers");
exports.customPlugin = (0, postgraphile_1.makeExtendSchemaPlugin)(() => ({
    typeDefs: [typeDefs_1.userTypeDefs, typeDefs_1.siteTypeDefs],
    resolvers: {
        Mutation: {
            ...resolvers_1.userResolvers.Mutation,
            ...resolvers_1.siteResolvers.Mutation,
        },
    },
}));
