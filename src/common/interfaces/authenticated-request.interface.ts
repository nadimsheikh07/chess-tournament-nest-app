import type { Request } from 'express';
import type { UserRole } from '../enums/user-role.enum';

export interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
    sub?: string;
    role: UserRole;
  };
}
