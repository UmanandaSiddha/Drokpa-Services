import { Module } from '@nestjs/common';
import { VehicleController } from './vehicle.controller';
import { VehicleService } from './vehicle.service';
import { DatabaseModule } from 'src/services/database/database.module';
import { AuthModule } from 'src/modules/auth/auth.module';

@Module({
    imports: [DatabaseModule, AuthModule],
    controllers: [VehicleController],
    providers: [VehicleService],
    exports: [VehicleService],
})
export class VehicleModule { }
