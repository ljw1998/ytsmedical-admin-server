const { ForbiddenError } = require('../utils/errors');

const requirePermission = (permission) => {
  return (req, res, next) => {
    const user = req.user;

    if (!user) {
      return next(new ForbiddenError('User not authenticated'));
    }

    if (user.roles && user.roles.includes('super_admin')) {
      return next();
    }

    if (!user.permissions || !user.permissions.includes(permission)) {
      return next(new ForbiddenError(`Missing permission: ${permission}`));
    }

    next();
  };
};

const requireAllPermissions = (permissions) => {
  return (req, res, next) => {
    const user = req.user;

    if (!user) {
      return next(new ForbiddenError('User not authenticated'));
    }

    if (user.roles && user.roles.includes('super_admin')) {
      return next();
    }

    const hasAll = permissions.every(p => user.permissions && user.permissions.includes(p));
    if (!hasAll) {
      return next(new ForbiddenError('Insufficient permissions'));
    }

    next();
  };
};

const requireAnyPermission = (permissions) => {
  return (req, res, next) => {
    const user = req.user;

    if (!user) {
      return next(new ForbiddenError('User not authenticated'));
    }

    if (user.roles && user.roles.includes('super_admin')) {
      return next();
    }

    const hasAny = permissions.some(p => user.permissions && user.permissions.includes(p));
    if (!hasAny) {
      return next(new ForbiddenError('Insufficient permissions'));
    }

    next();
  };
};

const requireRole = (role) => {
  return (req, res, next) => {
    const user = req.user;

    if (!user) {
      return next(new ForbiddenError('User not authenticated'));
    }

    if (!user.roles || !user.roles.includes(role)) {
      return next(new ForbiddenError(`Missing role: ${role}`));
    }

    next();
  };
};

const requireAnyRole = (roles) => {
  return (req, res, next) => {
    const user = req.user;

    if (!user) {
      return next(new ForbiddenError('User not authenticated'));
    }

    const hasAny = roles.some(r => user.roles && user.roles.includes(r));
    if (!hasAny) {
      return next(new ForbiddenError('Insufficient role access'));
    }

    next();
  };
};

module.exports = {
  requirePermission,
  requireAllPermissions,
  requireAnyPermission,
  requireRole,
  requireAnyRole
};
