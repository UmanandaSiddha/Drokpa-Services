import { Module } from '@nestjs/common';
import { POIController } from './poi.controller';
import { POIService } from './poi.service';
import { DatabaseModule } from 'src/services/database/database.module';
import { AuthModule } from 'src/modules/auth/auth.module';

@Module({
    imports: [DatabaseModule, AuthModule],
    controllers: [POIController],
    providers: [POIService],
    exports: [POIService],
})
export class POIModule { }
