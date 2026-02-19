import {
	Injectable,
	CanActivate,
	ExecutionContext,
	ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from 'generated/prisma/enums';

@Injectable()
export class RoleGuard implements CanActivate {
	constructor(private reflector: Reflector) { }

	canActivate(context: ExecutionContext): boolean {
		const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
			'roles',
			[context.getHandler(), context.getClass()],
		);

		if (!requiredRoles || requiredRoles.length === 0) {
			return true;
		}

		const request = context.switchToHttp().getRequest();
		const user = request.user;

		if (!user) {
			throw new ForbiddenException('Authentication required');
		}
		if (!Array.isArray(user.roles)) {
			throw new ForbiddenException('User roles not found');
		}

		const userRoles: UserRole[] = user.roles.map(
			(r: { role: UserRole }) => r.role,
		);

		const hasRequiredRole = requiredRoles.some((role) =>
			userRoles.includes(role),
		);

		if (!hasRequiredRole) {
			throw new ForbiddenException(
				`Access denied. Required roles: ${requiredRoles.join(', ')}`,
			);
		}

		return true;
	}
}

