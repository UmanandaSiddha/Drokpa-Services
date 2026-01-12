import { IsArray, IsEmail, IsEnum, IsNotEmpty } from 'class-validator';
import { ProviderType } from 'generated/prisma/enums';

export class CreateOnboardingDto {
    @IsArray()
    @IsEnum(ProviderType, { each: true })
    providerType: ProviderType[];

    @IsEmail()
    @IsNotEmpty()
    email: string;
}
