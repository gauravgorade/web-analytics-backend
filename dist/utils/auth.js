"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserIdFromRequest = getUserIdFromRequest;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
function getUserIdFromRequest(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader)
        return null;
    try {
        const decoded = jsonwebtoken_1.default.verify(authHeader, config_1.config.JWT_SECRET);
        return decoded.userId;
    }
    catch (err) {
        console.error("Invalid token:", err);
        return null;
    }
}
