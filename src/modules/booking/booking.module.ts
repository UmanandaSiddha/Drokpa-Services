import { Module } from '@nestjs/common';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { DatabaseModule } from 'src/services/database/database.module';
import { EmailModule } from 'src/services/email/email.module';
import { AuthModule } from 'src/modules/auth/auth.module';
import { AdminModule } from 'src/modules/admin/admin.module';

@Module({
    imports: [DatabaseModule, EmailModule, AuthModule, AdminModule],
    controllers: [BookingController],
    providers: [BookingService],
    exports: [BookingService],
})
export class BookingModule { }
