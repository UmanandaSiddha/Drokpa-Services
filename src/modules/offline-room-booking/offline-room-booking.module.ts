import { Module } from '@nestjs/common';
import { OfflineRoomBookingService } from './offline-room-booking.service';
import { OfflineRoomBookingController } from './offline-room-booking.controller';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from 'src/services/database/database.module';

@Module({
    imports: [AuthModule, DatabaseModule],
    controllers: [OfflineRoomBookingController],
    providers: [OfflineRoomBookingService],
    exports: [OfflineRoomBookingService],
})
export class OfflineRoomBookingModule { }
