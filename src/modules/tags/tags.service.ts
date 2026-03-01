import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from 'src/services/database/database.service';
import { PrismaApiFeatures } from 'src/utils/apiFeatures';
import { QueryString } from 'src/utils/apiFeatures';

@Injectable()
export class TagsService {
    constructor(
        private readonly databaseService: DatabaseService,
    ) { }

    // ─────────────────────────────────────────
    // GET all tags with pagination and search
    // ─────────────────────────────────────────
    async getAllTags(query: QueryString) {
        const limit = 20;
        const features = new PrismaApiFeatures(this.databaseService.tag, query)
            .search(['label', 'category'])
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
    // GET tag by ID
    // ─────────────────────────────────────────
    async getTagById(id: string) {
        const tag = await this.databaseService.tag.findUnique({
            where: { id },
            include: {
                tours: { include: { tour: true } },
                homestays: { include: { homestay: true } },
            },
        });

        if (!tag) {
            throw new NotFoundException(`Tag with ID ${id} not found`);
        }

        return tag;
    }

    // ─────────────────────────────────────────
    // CREATE tag
    // ─────────────────────────────────────────
    async createTag(data: { label: string; color: string; icon?: string; category?: string }) {
        // Check if label already exists
        const existing = await this.databaseService.tag.findUnique({
            where: { label: data.label },
        });

        if (existing) {
            throw new BadRequestException(`Tag with label "${data.label}" already exists`);
        }

        const tag = await this.databaseService.tag.create({
            data: {
                label: data.label,
                color: data.color,
                icon: data.icon,
                category: data.category,
            },
        });

        return tag;
    }

    // ─────────────────────────────────────────
    // UPDATE tag
    // ─────────────────────────────────────────
    async updateTag(id: string, data: { label?: string; color?: string; icon?: string; category?: string }) {
        // Check if tag exists
        const tag = await this.databaseService.tag.findUnique({
            where: { id },
        });

        if (!tag) {
            throw new NotFoundException(`Tag with ID ${id} not found`);
        }

        // If label is being changed, check for duplicates
        if (data.label && data.label !== tag.label) {
            const existing = await this.databaseService.tag.findUnique({
                where: { label: data.label },
            });
            if (existing) {
                throw new BadRequestException(`Tag with label "${data.label}" already exists`);
            }
        }

        const updated = await this.databaseService.tag.update({
            where: { id },
            data,
        });

        return updated;
    }

    // ─────────────────────────────────────────
    // DELETE tag
    // ─────────────────────────────────────────
    async deleteTag(id: string) {
        // Check if tag exists
        const tag = await this.databaseService.tag.findUnique({
            where: { id },
            include: {
                tours: true,
                homestays: true,
            },
        });

        if (!tag) {
            throw new NotFoundException(`Tag with ID ${id} not found`);
        }

        // Check if tag is in use
        const inUse = tag.tours.length > 0 || tag.homestays.length > 0;
        if (inUse) {
            throw new BadRequestException(
                `Cannot delete tag "${tag.label}" because it is assigned to ${tag.tours.length} tour(s) and ${tag.homestays.length} homestay(ies). Remove it from all products before deleting.`
            );
        }

        await this.databaseService.tag.delete({
            where: { id },
        });

        return { message: `Tag "${tag.label}" deleted successfully` };
    }
}
