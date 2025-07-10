import { gql } from "postgraphile";

export const siteTypeDefs = gql`
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
