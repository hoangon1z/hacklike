import { UserRole } from '@prisma/client';
export interface AuthUser { sub: string; email: string; role: UserRole; v?: number }
