import { Module } from '@nestjs/common';
import { PermitController } from './permit.controller';
import { PermitService } from './permit.service';
import { DatabaseModule } from 'src/services/database/database.module';
import { AuthModule } from 'src/modules/auth/auth.module';

@Module({
    imports: [DatabaseModule, AuthModule],
    controllers: [PermitController],
    providers: [PermitService],
    exports: [PermitService],
})
export class PermitModule { }
