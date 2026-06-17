import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { Request, Response, NextFunction } from 'express';
import { User, UserRole } from '../models/User';
import {
  authenticate,
  generateToken,
  requirePasswordChanged,
  AuthenticatedRequest,
} from '../middlewares/auth';
import { requireRole } from '../middlewares/rbac';
import { maintenanceMode } from '../middlewares/maintenanceMode';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

jest.mock('../config/env', () => ({
  env: {
    JWT_SECRET: 'test-secret-key-for-unit-tests-min-32-chars!!',
    JWT_EXPIRES_IN: '1h',
    NODE_ENV: 'test',
    LOG_LEVEL: 'error',
    MAINTENANCE_MODE: false,
  },
}));

jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await User.deleteMany({});
  jest.clearAllMocks();
});

function buildMocks(headers: Record<string, string> = {}) {
  const req = { headers } as unknown as Request;
  const res = {} as Response;
  const next = jest.fn() as jest.MockedFunction<NextFunction>;
  return { req, res, next };
}

function makeUserReq(role: UserRole, mustChangePassword = false) {
  const { req, res, next } = buildMocks();
  (req as AuthenticatedRequest).user = {
    id: new mongoose.Types.ObjectId(),
    email: 'u@test.com',
    role,
    mustChangePassword,
  } as any;
  return { req, res, next };
}

// ─── authenticate ────────────────────────────────────────────────────────────

describe('authenticate middleware', () => {
  it('should populate req.user and call next() with a valid token', async () => {
    const user = await User.create({
      email: 'auth@test.com',
      password: 'hashedpw',
      name: 'Auth User',
      role: UserRole.CPF_USER,
      cpf: '12345678901',
    });

    const token = generateToken(user as any);
    const { req, res, next } = buildMocks({ authorization: `Bearer ${token}` });

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(); // no error
    const authReq = req as AuthenticatedRequest;
    expect(authReq.user.email).toBe('auth@test.com');
    expect(authReq.user.role).toBe(UserRole.CPF_USER);
  });

  it('should call next with UnauthorizedError when no Authorization header', async () => {
    const { req, res, next } = buildMocks();

    await authenticate(req, res, next);

    const err = next.mock.calls[0][0] as unknown as UnauthorizedError;
    expect(err).toBeInstanceOf(UnauthorizedError);
    expect(err.statusCode).toBe(401);
  });

  it('should call next with UnauthorizedError on a tampered token', async () => {
    const { req, res, next } = buildMocks({
      authorization: 'Bearer header.tampered.signature',
    });

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('should call next with UnauthorizedError when user is inactive', async () => {
    const user = await User.create({
      email: 'inactive@test.com',
      password: 'hashedpw',
      name: 'Inactive User',
      role: UserRole.CPF_USER,
      cpf: '99988877766',
      isActive: false,
    });

    const token = generateToken(user as any);
    const { req, res, next } = buildMocks({ authorization: `Bearer ${token}` });

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('should call next with UnauthorizedError when user no longer exists in DB', async () => {
    // Create user, generate token, then delete the user
    const user = await User.create({
      email: 'ghost@test.com',
      password: 'hashedpw',
      name: 'Ghost',
      role: UserRole.CPF_USER,
      cpf: '11122233311',
    });
    const token = generateToken(user as any);
    await User.deleteOne({ _id: user._id });

    const { req, res, next } = buildMocks({ authorization: `Bearer ${token}` });
    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });
});

// ─── requirePasswordChanged ───────────────────────────────────────────────────

describe('requirePasswordChanged middleware', () => {
  it('should call next() when mustChangePassword is false', () => {
    const { req, res, next } = makeUserReq(UserRole.CPF_USER, false);

    requirePasswordChanged(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should call next with ForbiddenError when mustChangePassword is true', () => {
    const { req, res, next } = makeUserReq(UserRole.EMPLOYEE, true);

    requirePasswordChanged(req, res, next);

    const err = next.mock.calls[0][0] as unknown as ForbiddenError;
    expect(err).toBeInstanceOf(ForbiddenError);
    expect(err.statusCode).toBe(403);
  });
});

// ─── requireRole ─────────────────────────────────────────────────────────────

describe('requireRole middleware', () => {
  it('should call next() when user has the exact required role', () => {
    const { req, res, next } = makeUserReq(UserRole.SUPER_ADMIN);

    requireRole(UserRole.SUPER_ADMIN)(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should call next() when user role is one of multiple allowed roles', () => {
    const { req, res, next } = makeUserReq(UserRole.EMPLOYEE);

    requireRole(UserRole.EMPLOYEE, UserRole.CPF_USER)(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should call next with ForbiddenError when role is not in allowed list', () => {
    const { req, res, next } = makeUserReq(UserRole.EMPLOYEE);

    requireRole(UserRole.SUPER_ADMIN)(req, res, next);

    const err = next.mock.calls[0][0] as unknown as ForbiddenError;
    expect(err).toBeInstanceOf(ForbiddenError);
    expect(err.statusCode).toBe(403);
  });

  it('should call next with ForbiddenError when req.user is missing', () => {
    const { req, res, next } = buildMocks();

    requireRole(UserRole.CPF_USER)(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  // Security: PIX route restriction
  it('should block EMPLOYEE from CPF_USER-only PIX route', () => {
    const { req, res, next } = makeUserReq(UserRole.EMPLOYEE);

    requireRole(UserRole.CPF_USER)(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('should block COMPANY_VIEWER from CPF_USER-only PIX route', () => {
    const { req, res, next } = makeUserReq(UserRole.COMPANY_VIEWER);

    requireRole(UserRole.CPF_USER)(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('should allow COMPANY_VIEWER when included in multi-role PIX guard', () => {
    const { req, res, next } = makeUserReq(UserRole.COMPANY_VIEWER);

    requireRole(UserRole.CPF_USER, UserRole.COMPANY_VIEWER)(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should block EMPLOYEE from SUPER_ADMIN-only routes', () => {
    const { req, res, next } = makeUserReq(UserRole.EMPLOYEE);

    requireRole(UserRole.SUPER_ADMIN)(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('should allow CPF_USER to access CPF_USER-only route', () => {
    const { req, res, next } = makeUserReq(UserRole.CPF_USER);

    requireRole(UserRole.CPF_USER)(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });
});

// ─── maintenanceMode middleware ───────────────────────────────────────────────

describe('maintenanceMode middleware', () => {
  // jest.requireMock gives us the same mutable object used inside the module
  const mutableEnv = (jest.requireMock('../config/env') as any).env;

  function buildRes() {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    return { res: { status } as unknown as Response, status, json };
  }

  afterEach(() => {
    mutableEnv.MAINTENANCE_MODE = false;
  });

  it('should call next() when MAINTENANCE_MODE is false', () => {
    mutableEnv.MAINTENANCE_MODE = false;
    const { req, res, next } = buildMocks({ 'x-path': '/dashboard' });
    (req as any).path = '/dashboard';

    maintenanceMode(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should call next() for /health even when MAINTENANCE_MODE is true', () => {
    mutableEnv.MAINTENANCE_MODE = true;
    const { req, res, next } = buildMocks();
    (req as any).path = '/health';

    maintenanceMode(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should return 503 for a regular request when MAINTENANCE_MODE is true', () => {
    mutableEnv.MAINTENANCE_MODE = true;
    const { req, next } = buildMocks();
    (req as any).path = '/payments';
    const { res, status, json } = buildRes();

    maintenanceMode(req, res, next);

    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ maintenanceMode: true }));
    expect(next).not.toHaveBeenCalled();
  });

  it('should allow SUPER_ADMIN through when MAINTENANCE_MODE is true', async () => {
    mutableEnv.MAINTENANCE_MODE = true;

    const user = await User.create({
      email: 'super@test.com',
      password: 'hashedpw',
      name: 'Super Admin',
      role: UserRole.SUPER_ADMIN,
    });

    const token = generateToken(user as any);
    const { req, res, next } = buildMocks({ authorization: `Bearer ${token}` });
    (req as any).path = '/admin/overview';

    maintenanceMode(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });
});
