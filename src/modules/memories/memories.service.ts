import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from 'src/services/database/database.service';
import { CreateMemoryDto } from './dto/create-memory.dto';

@Injectable()
export class MemoriesService {
    constructor(
        private readonly databaseService: DatabaseService,
    ) { }

    async createMemory(userId: string, dto: CreateMemoryDto) {
        return this.databaseService.memories.create({
            data: {
                userId,
                ...dto,
            },
        });
    }

    async getMemories(filters?: { userId?: string; search?: string }) {
        return this.databaseService.memories.findMany({
            where: {
                ...(filters?.userId && { userId: filters.userId }),
                ...(filters?.search && {
                    OR: [
                        { title: { contains: filters.search, mode: 'insensitive' } },
                        { description: { contains: filters.search, mode: 'insensitive' } },
                    ],
                }),
            },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        avatarUrl: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getMemory(id: string) {
        const memory = await this.databaseService.memories.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        avatarUrl: true,
                    },
                },
            },
        });

        if (!memory) {
            throw new NotFoundException('Memory not found');
        }

        return memory;
    }

    async updateMemory(id: string, userId: string, dto: Partial<CreateMemoryDto>) {
        const memory = await this.databaseService.memories.findUnique({
            where: { id },
        });

        if (!memory) {
            throw new NotFoundException('Memory not found');
        }

        if (memory.userId !== userId) {
            throw new BadRequestException('Unauthorized to update this memory');
        }

        return this.databaseService.memories.update({
            where: { id },
            data: dto,
        });
    }

    async deleteMemory(id: string, userId: string) {
        const memory = await this.databaseService.memories.findUnique({
            where: { id },
        });

        if (!memory) {
            throw new NotFoundException('Memory not found');
        }

        if (memory.userId !== userId) {
            throw new BadRequestException('Unauthorized to delete this memory');
        }

        await this.databaseService.memories.delete({
            where: { id },
        });

        return { message: 'Memory deleted successfully' };
    }

    async getMyMemories(userId: string) {
        return this.databaseService.memories.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
    }
}
