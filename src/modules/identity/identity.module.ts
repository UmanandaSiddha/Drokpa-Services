import { Module } from '@nestjs/common';
import { IdentityController } from './identity.controller';
import { IdentityService } from './identity.service';
import { DigiLockerService } from './digilocker.service';
import { DatabaseModule } from 'src/services/database/database.module';
import { AuthModule } from 'src/modules/auth/auth.module';
import { ConfigModule } from '@nestjs/config';

@Module({
    imports: [DatabaseModule, AuthModule, ConfigModule],
    controllers: [IdentityController],
    providers: [IdentityService, DigiLockerService],
    exports: [IdentityService],
})
export class IdentityModule { }
