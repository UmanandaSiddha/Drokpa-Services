import { Module } from '@nestjs/common';
import { TagsController } from './tags.controller';
import { TagsService } from './tags.service';
import { DatabaseModule } from 'src/services/database/database.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [DatabaseModule, AuthModule],
    controllers: [TagsController],
    providers: [TagsService],
    exports: [TagsService],
})
export class TagsModule { }
