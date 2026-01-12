import { Module } from '@nestjs/common';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { DatabaseModule } from 'src/services/database/database.module';
import { AuthModule } from 'src/modules/auth/auth.module';

@Module({
    imports: [DatabaseModule, AuthModule],
    controllers: [ReviewsController],
    providers: [ReviewsService],
    exports: [ReviewsService],
})
export class ReviewsModule { }
