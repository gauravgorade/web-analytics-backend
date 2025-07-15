import { gql } from "postgraphile";

export const siteTypeDefs = gql`
  input AddSiteInput {
    domain: String!
  }

  type SitePayload {
    id: UUID!
    domain: String!
    publicKey: String!
    createdAt: String!
  }

  type AddSiteResponse implements MutationResponse {
    success: Boolean!
    message: String!
    data: SitePayload
  }

  type SiteKPIStats {
    uniqueVisitors: Int!
    totalVisits: Int!
    totalPageviews: Int!
    viewsPerVisit: Float!
    bounceRate: Float!
    averageVisitDuration: Float!
  }

  type SiteKPIStatsResponse implements MutationResponse {
    success: Boolean!
    message: String!
    data: SiteKPIStats
  }

  extend type Mutation {
    addSite(input: AddSiteInput!): AddSiteResponse
  }

  extend type Query {
    siteKPIStats(siteId: UUID!, startAt: String!, endAt: String!): SiteKPIStatsResponse!
  }
`;
