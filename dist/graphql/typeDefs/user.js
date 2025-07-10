"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userTypeDefs = void 0;
const postgraphile_1 = require("postgraphile");
exports.userTypeDefs = (0, postgraphile_1.gql) `
  input CustomCreateUserInput {
    name: String!
    email: String!
    password: String!
  }

  input LoginUserInput {
    email: String!
    password: String!
  }

  type CustomCreateUserPayload {
    name: String!
    email: String!
    timezone: String!
    dateFormat: String!
  }

  type CustomLoginUserPayload {
    name: String!
    email: String!
    timezone: String!
    dateFormat: String!
    sites: [CustomCreateSitePayload!]!
  }

  type CreateUserWithHashResponse {
    success: Boolean!
    message: String
    user: CustomCreateUserPayload
  }

  type LoginUserResponse {
    success: Boolean!
    message: String
    token: String!
    user: CustomLoginUserPayload
  }

  extend type Mutation {
    createUserWithHash(input: CustomCreateUserInput!): CreateUserWithHashResponse
    login(input: LoginUserInput!): LoginUserResponse
  }
`;
