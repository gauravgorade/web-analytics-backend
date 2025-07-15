import { gql } from "postgraphile";

export const commonTypes = gql`
  interface MutationResponse {
    success: Boolean!
    message: String!
  }

  interface QueryResponse {
    success: Boolean!
    message: String!
  }

  type BasicResponse implements MutationResponse {
    success: Boolean!
    message: String!
  }

  type BasicQueryResponse implements QueryResponse {
    success: Boolean!
    message: String!
  }
`;
