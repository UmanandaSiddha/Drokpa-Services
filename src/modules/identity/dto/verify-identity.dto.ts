import { IsEnum, IsString, IsOptional } from 'class-validator';
import { IdentityProvider } from 'generated/prisma/enums';

export class VerifyIdentityDto {
    @IsEnum(IdentityProvider)
    provider: IdentityProvider;

    @IsString()
    @IsOptional()
    providerRefId?: string;
}
