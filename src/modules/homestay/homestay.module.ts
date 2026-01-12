import { Module } from '@nestjs/common';
import { HomestayController } from './homestay.controller';
import { HomestayService } from './homestay.service';
import { DatabaseModule } from 'src/services/database/database.module';
import { AuthModule } from 'src/modules/auth/auth.module';

@Module({
    imports: [DatabaseModule, AuthModule],
    controllers: [HomestayController],
    providers: [HomestayService],
    exports: [HomestayService],
})
export class HomestayModule { }
