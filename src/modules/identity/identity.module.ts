import { Module } from '@nestjs/common';
import { IdentityController } from './identity.controller';
import { IdentityService } from './identity.service';
import { DatabaseModule } from 'src/services/database/database.module';
import { AuthModule } from 'src/modules/auth/auth.module';

@Module({
    imports: [DatabaseModule, AuthModule],
    controllers: [IdentityController],
    providers: [IdentityService],
    exports: [IdentityService],
})
export class IdentityModule { }
