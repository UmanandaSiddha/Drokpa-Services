import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { DatabaseService } from 'src/services/database/database.service';

@Module({
    providers: [SchedulerService, DatabaseService],
})
export class SchedulerModule { }