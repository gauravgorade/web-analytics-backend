import { gql } from "postgraphile";

export const siteTypeDefs = gql`
  input AddSiteInput {
    domain: String!
  }

  input TrafficStatsInput {
    siteId: UUID!
    startAt: String!
    endAt: String!
    dateGrouping: String!
  }

  type TrafficPayload {
    date: String!
    visitors: Int!
    pageviews: Int!
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
    avgDailyUsers: Int!
    avgWeeklyUsers: Int!
    avgMonthlyUsers: Int!
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

  type TrafficStatsResponse implements QueryResponse {
    success: Boolean!
    message: String!
    data: [TrafficPayload!]!
  }

  extend type Mutation {
    addSite(input: AddSiteInput!): AddSiteResponse
  }

  extend type Query {
    siteLiveStats(siteId: UUID!): SiteLiveStatsResponse!
    siteKPIStats(siteId: UUID!, startAt: String!, endAt: String!): SiteKPIStatsResponse!
    siteTrafficStats(input: TrafficStatsInput!): TrafficStatsResponse!
  }
`;
