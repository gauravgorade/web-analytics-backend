import { gql } from "postgraphile";

export const commonTypes = gql`
  interface MutationResponse {
    success: Boolean!
    message: String!
  }

  type BasicResponse implements MutationResponse {
    success: Boolean!
    message: String!
  }
`;
