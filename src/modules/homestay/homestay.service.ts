import { Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "src/services/database/database.service";
import { CreateHomestayDto } from "./dto/create-homestay.dto";

@Injectable()
export class HomestayService {
    constructor(
        private readonly databaseService: DatabaseService
    ) { }

    async createHomestay(providerId: string, dto: CreateHomestayDto) {
        return this.databaseService.homestay.create({
            data: {
                ...dto,
                providerId,
            },
        });
    }

    async getProviderHomestays(providerId: string) {
        return this.databaseService.homestay.findMany({
            where: { providerId },
            include: {
                rooms: true,
                address: true,
            },
        });
    }

    async getHomestays(filters?: { isActive?: boolean; providerId?: string }) {
        return this.databaseService.homestay.findMany({
            where: {
                ...(filters?.isActive !== undefined && { isActive: filters.isActive }),
                ...(filters?.providerId && { providerId: filters.providerId }),
            },
            include: {
                provider: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                address: true,
                rooms: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getHomestay(id: string) {
        const homestay = await this.databaseService.homestay.findUnique({
            where: { id },
            include: {
                provider: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                address: true,
                rooms: {
                    include: {
                        availability: true,
                    },
                },
            },
        });

        if (!homestay) {
            throw new NotFoundException('Homestay not found');
        }

        return homestay;
    }

    async updateHomestay(id: string, providerId: string, dto: Partial<CreateHomestayDto>) {
        const homestay = await this.databaseService.homestay.findUnique({
            where: { id },
        });

        if (!homestay) {
            throw new NotFoundException('Homestay not found');
        }

        if (homestay.providerId !== providerId) {
            throw new NotFoundException('Unauthorized to update this homestay');
        }

        return this.databaseService.homestay.update({
            where: { id },
            data: dto,
        });
    }
}