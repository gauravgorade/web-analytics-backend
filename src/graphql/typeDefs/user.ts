import { gql } from "postgraphile";

export const userTypeDefs = gql`
  input CreateUserInput {
    name: String!
    email: String!
    password: String!
  }

  input LoginInput {
    email: String!
    password: String!
  }

  type UserPayload {
    name: String!
    email: String!
    timezone: String!
    dateFormat: String!
  }

  type LoginUserPayload {
    name: String!
    email: String!
    timezone: String!
    dateFormat: String!
    sites: [SitePayload!]!
  }

  type LoginResponsePayload {
    token: String!
    user: LoginUserPayload!
  }

  type CreateUserResponse implements MutationResponse {
    success: Boolean!
    message: String!
    data: UserPayload
  }

  type LoginResponse implements MutationResponse {
    success: Boolean!
    message: String!
    data: LoginResponsePayload
  }

  extend type Mutation {
    createUserWithHash(input: CreateUserInput!): CreateUserResponse
    login(input: LoginInput!): LoginResponse
  }
`;
