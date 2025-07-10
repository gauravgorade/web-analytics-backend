"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.siteTypeDefs = void 0;
const postgraphile_1 = require("postgraphile");
exports.siteTypeDefs = (0, postgraphile_1.gql) `
  input CustomCreateSiteInput {
    domain: String!
  }

  type CustomCreateSitePayload {
    id: UUID!
    domain: String!
    publicKey: String!
    createdAt: String!
  }

  type AddSiteResponse {
    success: Boolean!
    message: String
    site: CustomCreateSitePayload
  }

  extend type Mutation {
    addSite(input: CustomCreateSiteInput!): AddSiteResponse
  }
`;
