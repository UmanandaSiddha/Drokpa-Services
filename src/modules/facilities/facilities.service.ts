import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from 'src/services/database/database.service';
import { PrismaApiFeatures } from 'src/utils/apiFeatures';
import { QueryString } from 'src/utils/apiFeatures';

@Injectable()
export class FacilitiesService {
    constructor(
        private readonly databaseService: DatabaseService,
    ) { }

    // ─────────────────────────────────────────
    // GET all facilities with pagination and search
    // ─────────────────────────────────────────
    async getAllFacilities(query: QueryString) {
        const limit = 20;
        const features = new PrismaApiFeatures(this.databaseService.facility, query)
            .search(['name', 'category', 'description'])
            .filter()
            .sort()
            .pagination(limit);

        const { results, totalCount } = await features.execute();

        const page = Number(query.page) || 1;
        const totalPages = Math.ceil(totalCount / limit);

        return {
            data: results,
            meta: {
                total: totalCount,
                page,
                limit,
                totalPages,
            },
        };
    }

    // ─────────────────────────────────────────
    // GET facility by ID
    // ─────────────────────────────────────────
    async getFacilityById(id: string) {
        const facility = await this.databaseService.facility.findUnique({
            where: { id },
            include: {
                homestays: { include: { homestay: true } },
            },
        });

        if (!facility) {
            throw new NotFoundException(`Facility with ID ${id} not found`);
        }

        return facility;
    }

    // ─────────────────────────────────────────
    // CREATE facility
    // ─────────────────────────────────────────
    async createFacility(data: { name: string; icon: string; description?: string; category?: string }) {
        // Check if name already exists
        const existing = await this.databaseService.facility.findUnique({
            where: { name: data.name },
        });

        if (existing) {
            throw new BadRequestException(`Facility with name "${data.name}" already exists`);
        }

        const facility = await this.databaseService.facility.create({
            data: {
                name: data.name,
                icon: data.icon,
                description: data.description,
                category: data.category,
            },
        });

        return facility;
    }

    // ─────────────────────────────────────────
    // UPDATE facility
    // ─────────────────────────────────────────
    async updateFacility(id: string, data: { name?: string; icon?: string; description?: string; category?: string }) {
        // Check if facility exists
        const facility = await this.databaseService.facility.findUnique({
            where: { id },
        });

        if (!facility) {
            throw new NotFoundException(`Facility with ID ${id} not found`);
        }

        // If name is being changed, check for duplicates
        if (data.name && data.name !== facility.name) {
            const existing = await this.databaseService.facility.findUnique({
                where: { name: data.name },
            });
            if (existing) {
                throw new BadRequestException(`Facility with name "${data.name}" already exists`);
            }
        }

        const updated = await this.databaseService.facility.update({
            where: { id },
            data,
        });

        return updated;
    }

    // ─────────────────────────────────────────
    // DELETE facility
    // ─────────────────────────────────────────
    async deleteFacility(id: string) {
        // Check if facility exists
        const facility = await this.databaseService.facility.findUnique({
            where: { id },
            include: {
                homestays: true,
            },
        });

        if (!facility) {
            throw new NotFoundException(`Facility with ID ${id} not found`);
        }

        // Check if facility is in use
        const inUse = facility.homestays.length > 0;
        if (inUse) {
            throw new BadRequestException(
                `Cannot delete facility "${facility.name}" because it is assigned to ${facility.homestays.length} homestay(ies). Remove it from all homestays before deleting.`
            );
        }

        await this.databaseService.facility.delete({
            where: { id },
        });

        return { message: `Facility "${facility.name}" deleted successfully` };
    }
}
