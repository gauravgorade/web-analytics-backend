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

  type SiteKPIStats {
    uniqueVisitors: Int!
    totalVisits: Int!
    totalPageviews: Int!
    viewsPerVisit: Float!
    bounceRate: Float!
    averageVisitDuration: Float!
  }

  type LiveStats {
    liveUsers: Int!
    activePages: [PageActivity!]!
    liveEvents: [EventActivity!]!
  }

  type PageActivity {
    path: String!
    count: Int!
  }

  type EventActivity {
    name: String!
    count: Int!
  }

  type AddSiteResponse implements MutationResponse {
    success: Boolean!
    message: String!
    data: SitePayload
  }

  type SiteKPIStatsResponse implements QueryResponse {
    success: Boolean!
    message: String!
    data: SiteKPIStats
  }

  type SiteLiveStatsResponse implements QueryResponse {
    success: Boolean!
    message: String!
    data: LiveStats
  }

  extend type Mutation {
    addSite(input: AddSiteInput!): AddSiteResponse
  }

  extend type Query {
    siteKPIStats(siteId: UUID!, startAt: String!, endAt: String!): SiteKPIStatsResponse!
    siteLiveStats(siteId: UUID!): SiteLiveStatsResponse!
  }
`;
