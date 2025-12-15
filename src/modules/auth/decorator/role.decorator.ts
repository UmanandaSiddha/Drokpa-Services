import { SetMetadata } from '@nestjs/common';
import { UserRoleMap } from 'generated/prisma/client';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: UserRoleMap[]) => SetMetadata(ROLES_KEY, roles);