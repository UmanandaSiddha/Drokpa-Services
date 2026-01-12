import { Module, forwardRef } from '@nestjs/common';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { DatabaseModule } from 'src/services/database/database.module';
import { AuthModule } from 'src/modules/auth/auth.module';

@Module({
    imports: [DatabaseModule, forwardRef(() => AuthModule)],
    controllers: [OnboardingController],
    providers: [OnboardingService],
    exports: [OnboardingService],
})
export class OnboardingModule { }
