import { Controller, Post, Get, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { MemoriesService } from './memories.service';
import { CreateMemoryDto } from './dto/create-memory.dto';
import { AuthGuard, getUser } from 'src/modules/auth/guards/auth.guard';

@Controller('memories')
export class MemoriesController {
    constructor(private readonly memoriesService: MemoriesService) { }

    @Post()
    @UseGuards(AuthGuard)
    createMemory(
        @Body() dto: CreateMemoryDto,
        @getUser('id') userId: string,
    ) {
        return this.memoriesService.createMemory(userId, dto);
    }

    @Get()
    getMemories(
        @Query('userId') userId?: string,
        @Query('search') search?: string,
    ) {
        return this.memoriesService.getMemories({ userId, search });
    }

    @Get('my-memories')
    @UseGuards(AuthGuard)
    getMyMemories(@getUser('id') userId: string) {
        return this.memoriesService.getMyMemories(userId);
    }

    @Get(':id')
    getMemory(@Param('id') id: string) {
        return this.memoriesService.getMemory(id);
    }

    @Put(':id')
    @UseGuards(AuthGuard)
    updateMemory(
        @Param('id') id: string,
        @Body() dto: Partial<CreateMemoryDto>,
        @getUser('id') userId: string,
    ) {
        return this.memoriesService.updateMemory(id, userId, dto);
    }

    @Delete(':id')
    @UseGuards(AuthGuard)
    deleteMemory(
        @Param('id') id: string,
        @getUser('id') userId: string,
    ) {
        return this.memoriesService.deleteMemory(id, userId);
    }
}
