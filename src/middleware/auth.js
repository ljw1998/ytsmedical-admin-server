const { verifyAccessToken } = require('../utils/jwt');
const { UnauthorizedError } = require('../utils/errors');
const supabase = require('../config/database');

const isUUID = (str) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

const getAdminUserWithPermissions = async (userId) => {
  const { data: adminUser, error: userError } = await supabase
    .from('admin_users')
    .select('id, email, full_name, is_active')
    .eq('id', userId)
    .single();

  if (userError || !adminUser) {
    throw new UnauthorizedError('Admin user not found');
  }

  const { data: permData } = await supabase
    .from('v_admin_user_permissions')
    .select('*')
    .eq('admin_user_id', userId)
    .single();

  return {
    id: adminUser.id,
    userId: adminUser.id,
    userType: 'admin',
    email: adminUser.email,
    fullName: adminUser.full_name,
    isActive: adminUser.is_active,
    permissions: permData?.permissions || [],
    roles: permData?.roles || []
  };
};

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedError('No authorization header provided');
    }

    // Development mode: Support "Dev <user_id>" format
    if (process.env.NODE_ENV === 'development' && authHeader.startsWith('Dev ')) {
      const userId = authHeader.substring(4).trim();

      if (!userId) {
        throw new UnauthorizedError('Invalid Dev token format. Use: Dev <user_id>');
      }

      try {
        const user = await getAdminUserWithPermissions(userId);

        if (!user.isActive) {
          throw new UnauthorizedError('Account has been disabled');
        }

        req.user = user;
        req.admin = user;

        console.log(`[DEV AUTH] Authenticated via Dev header: ${user.email}`);
        return next();
      } catch (error) {
        if (error instanceof UnauthorizedError) throw error;
        throw new UnauthorizedError('Invalid user ID for Dev authentication');
      }
    }

    // Standard Bearer token authentication
    if (!authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Invalid authorization format. Use: Bearer <token>');
    }

    const token = authHeader.substring(7);

    // Development mode: Support "Bearer dev:<user_id>" format
    if (process.env.NODE_ENV === 'development' && token.startsWith('dev:')) {
      const userId = token.substring(4);

      try {
        const user = await getAdminUserWithPermissions(userId);

        if (!user.isActive) {
          throw new UnauthorizedError('Account has been disabled');
        }

        req.user = user;
        req.admin = user;

        console.log(`[DEV AUTH] Authenticated via dev token: ${user.email}`);
        return next();
      } catch (error) {
        if (error instanceof UnauthorizedError) throw error;
        throw new UnauthorizedError('Invalid user ID in dev token');
      }
    }

    // Development mode: Support "Bearer <uuid>" format
    if (process.env.NODE_ENV === 'development' && isUUID(token)) {
      try {
        const user = await getAdminUserWithPermissions(token);

        if (!user.isActive) {
          throw new UnauthorizedError('Account has been disabled');
        }

        req.user = user;
        req.admin = user;

        console.log(`[DEV AUTH] Authenticated via UUID: ${user.email}`);
        return next();
      } catch (error) {
        if (error instanceof UnauthorizedError) throw error;
        throw new UnauthorizedError('Invalid admin user ID');
      }
    }

    // Production mode: Verify JWT token
    const payload = verifyAccessToken(token);

    if (payload.user_type !== 'admin') {
      throw new UnauthorizedError('Invalid token type');
    }

    req.user = {
      id: payload.user_id,
      userId: payload.user_id,
      userType: payload.user_type,
      email: payload.email,
      fullName: payload.full_name,
      permissions: payload.permissions || [],
      roles: payload.roles || []
    };

    req.admin = req.user;

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      next(new UnauthorizedError('Token expired'));
    } else if (error.name === 'JsonWebTokenError') {
      next(new UnauthorizedError('Invalid token'));
    } else if (error instanceof UnauthorizedError) {
      next(error);
    } else {
      console.error('Authentication error:', error.message);
      next(new UnauthorizedError('Authentication failed'));
    }
  }
};

const optionalAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return next();
    }

    await authenticate(req, res, (err) => {
      if (err) {
        return next();
      }
      next();
    });
  } catch (error) {
    next();
  }
};

module.exports = {
  authenticate,
  optionalAuthenticate,
  authMiddleware: authenticate
};
