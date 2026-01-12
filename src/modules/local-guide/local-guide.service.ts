import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DatabaseService } from 'src/services/database/database.service';
import { CreateLocalGuideDto } from './dto/create-local-guide.dto';

@Injectable()
export class LocalGuideService {
    constructor(
        private readonly databaseService: DatabaseService,
    ) { }

    async createGuide(providerId: string, dto: CreateLocalGuideDto) {
        return this.databaseService.localGuide.create({
            data: {
                ...dto,
                providerId,
            },
        });
    }

    async getGuides(filters?: { isActive?: boolean; providerId?: string; specialties?: string[] }) {
        return this.databaseService.localGuide.findMany({
            where: {
                ...(filters?.isActive !== undefined && { isActive: filters.isActive }),
                ...(filters?.providerId && { providerId: filters.providerId }),
                ...(filters?.specialties && {
                    specialties: {
                        hasSome: filters.specialties,
                    },
                }),
            },
            include: {
                provider: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                address: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getGuide(id: string) {
        const guide = await this.databaseService.localGuide.findUnique({
            where: { id },
            include: {
                provider: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                address: true,
            },
        });

        if (!guide) {
            throw new NotFoundException('Guide not found');
        }

        return guide;
    }

    async updateGuide(id: string, providerId: string, dto: Partial<CreateLocalGuideDto>) {
        const guide = await this.databaseService.localGuide.findUnique({
            where: { id },
        });

        if (!guide) {
            throw new NotFoundException('Guide not found');
        }

        if (guide.providerId !== providerId) {
            throw new ForbiddenException('You do not have permission to update this guide');
        }

        return this.databaseService.localGuide.update({
            where: { id },
            data: dto,
        });
    }

    async deleteGuide(id: string, providerId: string) {
        const guide = await this.databaseService.localGuide.findUnique({
            where: { id },
        });

        if (!guide) {
            throw new NotFoundException('Guide not found');
        }

        if (guide.providerId !== providerId) {
            throw new ForbiddenException('You do not have permission to delete this guide');
        }

        await this.databaseService.localGuide.delete({
            where: { id },
        });

        return { message: 'Guide deleted successfully' };
    }

    async getMyGuides(providerId: string) {
        return this.databaseService.localGuide.findMany({
            where: { providerId },
            include: {
                address: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }
}
