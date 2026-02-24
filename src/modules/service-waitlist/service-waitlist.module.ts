import { Module } from '@nestjs/common';
import { ServiceWaitlistService } from './service-waitlist.service';
import { ServiceWaitlistController } from './service-waitlist.controller';
import { DatabaseModule } from 'src/services/database/database.module';
import { EmailModule } from 'src/services/email/email.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [AuthModule, DatabaseModule, EmailModule],
    controllers: [ServiceWaitlistController],
    providers: [ServiceWaitlistService],
    exports: [ServiceWaitlistService],
})
export class ServiceWaitlistModule { }
