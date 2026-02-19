import { Module } from '@nestjs/common';
import { PayoutService } from './payout.service';
import { PayoutController } from './payout.controller';
import { DatabaseService } from 'src/services/database/database.service';

@Module({
    controllers: [PayoutController],
    providers: [PayoutService, DatabaseService],
    exports: [PayoutService],
})
export class PayoutModule { }