import { Module } from '@nestjs/common';
import { RoomAvailabilityController } from './room-availibility.controller';
import { RoomAvailabilityService } from './room-availibility.service';
import { DatabaseModule } from 'src/services/database/database.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [DatabaseModule, AuthModule],
    controllers: [RoomAvailabilityController],
    providers: [RoomAvailabilityService],
    exports: [RoomAvailabilityService],
})
export class RoomAvailabilityModule { }