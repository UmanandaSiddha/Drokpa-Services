import {
	Injectable,
	CanActivate,
	ExecutionContext,
	ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRoleMap } from 'generated/prisma/client';

@Injectable()
export class RoleGuard implements CanActivate {
	constructor(private reflector: Reflector) { }

	canActivate(context: ExecutionContext): boolean {
		const requiredRoles = this.reflector.getAllAndOverride<UserRoleMap[]>('roles', [
			context.getHandler(),
			context.getClass(),
		]);

		if (!requiredRoles) {
			return true;
		}

		const { user } = context.switchToHttp().getRequest();

		if (!user || !user.role) {
			throw new ForbiddenException('User role not found');
		}

		const hasRequiredRole = requiredRoles.includes(
			user.role as UserRoleMap,
		);

		if (!hasRequiredRole) {
			throw new ForbiddenException(`Access denied. Required roles: ${requiredRoles.join(', ')}`);
		}

		return true;
	}
}
