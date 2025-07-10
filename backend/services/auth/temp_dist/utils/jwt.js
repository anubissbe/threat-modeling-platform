"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAccessToken = generateAccessToken;
exports.generateRefreshToken = generateRefreshToken;
exports.verifyAccessToken = verifyAccessToken;
exports.verifyRefreshToken = verifyRefreshToken;
exports.getTokenExpirationTime = getTokenExpirationTime;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = require("./logger");
const JWT_SECRET = process.env['JWT_SECRET'] || 'your-super-secret-jwt-key';
const JWT_EXPIRES_IN = process.env['JWT_EXPIRES_IN'] || '15m';
const REFRESH_TOKEN_SECRET = process.env['REFRESH_TOKEN_SECRET'] || 'your-super-secret-refresh-key';
const REFRESH_TOKEN_EXPIRES_IN = process.env['REFRESH_TOKEN_EXPIRES_IN'] || '7d';
function generateAccessToken(user) {
    const payload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        organization: user.organization,
    };
    return jsonwebtoken_1.default.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
    });
}
function generateRefreshToken(userId) {
    // Add a unique JWT ID (jti) to prevent duplicate token issues
    const jti = crypto_1.default.randomBytes(16).toString('hex');
    return jsonwebtoken_1.default.sign({ userId, jti }, REFRESH_TOKEN_SECRET, {
        expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    });
}
function verifyAccessToken(token) {
    try {
        return jsonwebtoken_1.default.verify(token, JWT_SECRET);
    }
    catch (error) {
        logger_1.logger.warn('Invalid access token:', error);
        return null;
    }
}
function verifyRefreshToken(token) {
    try {
        return jsonwebtoken_1.default.verify(token, REFRESH_TOKEN_SECRET);
    }
    catch (error) {
        logger_1.logger.warn('Invalid refresh token:', error);
        return null;
    }
}
function getTokenExpirationTime() {
    // Convert JWT_EXPIRES_IN to seconds
    const match = JWT_EXPIRES_IN.match(/^(\d+)([smhd])$/);
    if (!match)
        return 900; // Default to 15 minutes
    const [, value, unit] = match;
    const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
    return parseInt(value) * multipliers[unit];
}
