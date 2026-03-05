import { IsArray, IsEnum, IsOptional } from 'class-validator';
import { ProviderType, UserRole } from 'generated/prisma/enums';

export class AdminUserRoleDto {
    @IsEnum(UserRole)
    role: UserRole;

    @IsOptional()
    @IsArray()
    providerTypes?: ProviderType[];
}
