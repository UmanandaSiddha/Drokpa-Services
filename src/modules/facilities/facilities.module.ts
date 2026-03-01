import { Module } from '@nestjs/common';
import { FacilitiesController } from './facilities.controller';
import { FacilitiesService } from './facilities.service';
import { DatabaseModule } from 'src/services/database/database.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [DatabaseModule, AuthModule],
    controllers: [FacilitiesController],
    providers: [FacilitiesService],
    exports: [FacilitiesService],
})
export class FacilitiesModule { }
