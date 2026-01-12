import { Module } from '@nestjs/common';
import { LocalGuideController } from './local-guide.controller';
import { LocalGuideService } from './local-guide.service';
import { DatabaseModule } from 'src/services/database/database.module';
import { AuthModule } from 'src/modules/auth/auth.module';

@Module({
    imports: [DatabaseModule, AuthModule],
    controllers: [LocalGuideController],
    providers: [LocalGuideService],
    exports: [LocalGuideService],
})
export class LocalGuideModule { }
