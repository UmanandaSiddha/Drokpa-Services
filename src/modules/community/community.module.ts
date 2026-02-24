import { Module } from '@nestjs/common';
import { CommunityService } from './community.service';
import { CommunityController } from './community.controller';
import { DatabaseModule } from 'src/services/database/database.module';
import { EmailModule } from 'src/services/email/email.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [DatabaseModule, EmailModule, AuthModule],
    controllers: [CommunityController],
    providers: [CommunityService],
    exports: [CommunityService],
})
export class CommunityModule { }
