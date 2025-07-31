import { gql } from "postgraphile";

export const userTypeDefs = gql`
  input AddUserInput {
    name: String!
    email: String!
    password: String!
  }

  input LoginInput {
    email: String!
    password: String!
  }

  input PreferencesInput {
    timezone: String!
    dateFormat: String!
  }

  type UserPayload {
    name: String!
    email: String!
    timezone: String!
    dateFormat: String!
    prefSet: Boolean!
  }

  type LoginUserPayload {
    name: String!
    email: String!
    timezone: String!
    dateFormat: String!
    prefSet: Boolean!
    sites: [SitePayload!]!
  }

  type PreferencesPayload {
    name: String!
    email: String!
    timezone: String!
    dateFormat: String!
    prefSet: Boolean!
  }

  type LoginResponsePayload {
    token: String!
    user: LoginUserPayload!
  }

  type AddUserResponse implements MutationResponse {
    success: Boolean!
    message: String!
    data: UserPayload
  }

  type LoginResponse implements MutationResponse {
    success: Boolean!
    message: String!
    data: LoginResponsePayload
  }

  type PreferencesResponse implements MutationResponse {
    success: Boolean!
    message: String!
    data: PreferencesPayload
  }

  extend type Mutation {
    addUserWithHash(input: AddUserInput!): AddUserResponse
    login(input: LoginInput!): LoginResponse
    addUserPreferences(input: PreferencesInput!): PreferencesResponse
  }
`;
