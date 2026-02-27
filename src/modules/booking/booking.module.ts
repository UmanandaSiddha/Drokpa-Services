import { Module } from '@nestjs/common';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { DatabaseModule } from 'src/services/database/database.module';
import { EmailModule } from 'src/services/email/email.module';
import { AuthModule } from 'src/modules/auth/auth.module';
import { AdminModule } from 'src/modules/admin/admin.module';
import { CouponModule } from 'src/modules/coupon/coupon.module';

@Module({
    imports: [DatabaseModule, EmailModule, AuthModule, AdminModule, CouponModule],
    controllers: [BookingController],
    providers: [BookingService],
    exports: [BookingService],
})
export class BookingModule { }
