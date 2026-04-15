const jwt = require('jsonwebtoken');
const { JWT_EXPIRY } = require('../config/constants');

const generateAccessToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: JWT_EXPIRY.ACCESS_TOKEN
  });
};

const generateRefreshToken = (payload) => {
  return jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: JWT_EXPIRY.REFRESH_TOKEN
  });
};

const generateTokens = (user) => {
  const accessPayload = {
    user_id: user.id,
    user_type: 'admin',
    email: user.email,
    full_name: user.full_name || user.fullName,
    permissions: user.permissions || [],
    roles: user.roles || []
  };

  const refreshPayload = {
    user_id: user.id
  };

  const accessToken = generateAccessToken(accessPayload);
  const refreshToken = generateRefreshToken(refreshPayload);

  return { accessToken, refreshToken };
};

const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
};

const getAccessTokenExpirySeconds = () => {
  const expiry = JWT_EXPIRY.ACCESS_TOKEN;
  if (expiry.endsWith('m')) {
    return parseInt(expiry) * 60;
  } else if (expiry.endsWith('h')) {
    return parseInt(expiry) * 60 * 60;
  } else if (expiry.endsWith('d')) {
    return parseInt(expiry) * 60 * 60 * 24;
  }
  return parseInt(expiry);
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
  getAccessTokenExpirySeconds
};
