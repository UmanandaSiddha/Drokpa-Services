import { Module } from '@nestjs/common';
import { CouponService } from './coupon.service';
import { CouponController } from './coupon.controller';
import { DatabaseModule } from 'src/services/database/database.module';

@Module({
    imports: [DatabaseModule],
    controllers: [CouponController],
    providers: [CouponService],
    exports: [CouponService], // BookingModule and others can inject CouponService
})
export class CouponModule { }
