import { Request, Response, NextFunction } from 'express';
import { login, getCurrentUser, changePassword, updateEmail, registerCpfUser } from '../services/authService.js';
import { loginSchema, changePasswordSchema, updateEmailSchema, registerCpfUserSchema } from '../validators/index.js';
import { sendSuccess } from '../utils/response.js';
import { AuthenticatedRequest } from '../middlewares/index.js';

export async function loginHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const validatedData = loginSchema.parse(req.body);
    const result = await login(validatedData.email, validatedData.password);
    sendSuccess(res, result, 200, 'Login successful');
  } catch (error) {
    next(error);
  }
}

export async function getMeHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const user = await getCurrentUser(authReq.user.id.toString());
    sendSuccess(res, { user });
  } catch (error) {
    next(error);
  }
}

export async function changePasswordHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const validatedData = changePasswordSchema.parse(req.body);
    const result = await changePassword(
      authReq.user.id.toString(),
      validatedData.currentPassword,
      validatedData.newPassword
    );
    sendSuccess(res, result, 200, 'Password changed successfully');
  } catch (error) {
    next(error);
  }
}

export async function updateEmailHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const validatedData = updateEmailSchema.parse(req.body);
    const result = await updateEmail(
      authReq.user.id.toString(),
      validatedData.newEmail,
      validatedData.password
    );
    sendSuccess(res, result, 200, 'Email updated successfully');
  } catch (error) {
    next(error);
  }
}

export async function registerCpfUserHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const validatedData = registerCpfUserSchema.parse(req.body);
    const result = await registerCpfUser(validatedData);
    sendSuccess(res, result, 201, 'Registration successful');
  } catch (error) {
    next(error);
  }
}
