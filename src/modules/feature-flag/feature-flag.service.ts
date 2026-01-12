import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/services/database/database.service';
import { UpdateFeatureFlagDto } from './dto/update-feature-flag.dto';
import { ServiceType } from 'generated/prisma/enums';

@Injectable()
export class FeatureFlagService {
    constructor(
        private readonly databaseService: DatabaseService,
    ) { }

    async getAllFeatureFlags() {
        return this.databaseService.featureFlag.findMany({
            orderBy: { serviceType: 'asc' },
        });
    }

    async getFeatureFlag(serviceType: ServiceType) {
        const flag = await this.databaseService.featureFlag.findUnique({
            where: { serviceType },
        });

        if (!flag) {
            // Return default enabled flag if not found
            return {
                serviceType,
                enabled: true,
                message: null,
            };
        }

        return flag;
    }

    async updateFeatureFlag(serviceType: ServiceType, dto: UpdateFeatureFlagDto) {
        const existing = await this.databaseService.featureFlag.findUnique({
            where: { serviceType },
        });

        if (existing) {
            return this.databaseService.featureFlag.update({
                where: { serviceType },
                data: dto,
            });
        }

        return this.databaseService.featureFlag.create({
            data: {
                serviceType,
                ...dto,
            },
        });
    }

    async isServiceEnabled(serviceType: ServiceType): Promise<boolean> {
        const flag = await this.getFeatureFlag(serviceType);
        return flag.enabled;
    }

    async getServiceMessage(serviceType: ServiceType): Promise<string | null> {
        const flag = await this.getFeatureFlag(serviceType);
        return flag.enabled ? null : flag.message;
    }
}
