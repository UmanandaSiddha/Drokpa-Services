import { Module } from '@nestjs/common';
import { DatabaseService } from 'src/services/database/database.service';
import { RoomAvailabilityController } from './room-availibility.controller';
import { RoomAvailabilityService } from './room-availibility.service';

@Module({
    controllers: [RoomAvailabilityController],
    providers: [RoomAvailabilityService, DatabaseService],
    exports: [RoomAvailabilityService],
})
export class RoomAvailabilityModule { }