import { gql } from "postgraphile";

export const siteTypeDefs = gql`
  input AddSiteInput {
    domain: String!
  }

  type TrafficPayload {
    dateGrouping: String!
    visitors: Int!
    pageviews: Int!
  }

  type SitePayload {
    id: UUID!
    domain: String!
    publicKey: String!
    createdAt: String!
  }

  type SiteKPISummaryPayload {
    uniqueVisitors: Int!
    totalVisits: Int!
    totalPageviews: Int!
    viewsPerVisit: Float!
    bounceRate: Float!
    averageVisitDuration: Float!
  }

  type LiveStatsPayload {
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

  type SiteKPISummaryResponse implements QueryResponse {
    success: Boolean!
    message: String!
    data: SiteKPISummaryPayload
  }

  type SiteLiveStatsResponse implements QueryResponse {
    success: Boolean!
    message: String!
    data: LiveStatsPayload
  }

  type TrafficTrendsResponse implements QueryResponse {
    success: Boolean!
    message: String!
    data: [TrafficPayload!]!
  }

  extend type Mutation {
    addSite(input: AddSiteInput!): AddSiteResponse
  }

  extend type Query {
    siteLiveStats(siteId: UUID!): SiteLiveStatsResponse!
    siteKPISummary(siteId: UUID!, startAt: String!, endAt: String!): SiteKPISummaryResponse!
    siteTrafficTrends(siteId: UUID!, startAt: String!, endAt: String!, dateGrouping: String!): TrafficTrendsResponse!
  }
`;
