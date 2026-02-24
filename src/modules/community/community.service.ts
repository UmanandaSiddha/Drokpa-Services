import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/services/database/database.service';
import { LoggerService } from 'src/services/logger/logger.service';
import { EmailService } from 'src/services/email/email.service';
import { PrismaApiFeatures, QueryString } from 'src/utils/apiFeatures';

@Injectable()
export class CommunityService {
    private readonly logger = new LoggerService(CommunityService.name);

    constructor(
        private readonly databaseService: DatabaseService,
        private readonly emailService: EmailService,
    ) { }

    /**
     * Submit request to join community
     */
    async submitJoinRequest(data: {
        fullName: string;
        email: string;
        phoneNumber: string;
        location?: string;
        interests: string[];
        message?: string;
    }) {
        // Check if email already exists
        const existing = await this.databaseService.communityJoinRequest.findUnique({
            where: { email: data.email },
        });

        if (existing) {
            throw new BadRequestException('Email already submitted a join request');
        }

        const request = await this.databaseService.communityJoinRequest.create({
            data: {
                fullName: data.fullName,
                email: data.email,
                phoneNumber: data.phoneNumber,
                location: data.location ?? null,
                interests: data.interests,
                message: data.message ?? null,
                contacted: false,
            },
        });

        this.logger.log(`Community join request created: ${request.id} for ${data.email}`);
        return request;
    }

    /**
     * Get join request by email
     */
    async getRequestByEmail(email: string) {
        const request = await this.databaseService.communityJoinRequest.findUnique({
            where: { email },
        });

        if (!request) {
            throw new NotFoundException('No join request found for this email');
        }

        return request;
    }

    /**
     * Get all join requests (admin)
     */
    async getAllRequests(query: QueryString) {
        const contacted = query.contacted === 'true' ? true : query.contacted === 'false' ? false : undefined;

        const apiFeatures = new PrismaApiFeatures(
            this.databaseService.communityJoinRequest,
            query,
        )
            .where(contacted !== undefined ? { contacted } as any : {})
            .sort({ createdAt: 'desc' } as any)
            .pagination(20);

        const { results, totalCount } = await apiFeatures.execute();
        const limit = Number(query.limit) || 20;
        const page = Number(query.page) || 1;

        return {
            data: results,
            meta: {
                total: totalCount,
                page,
                limit,
                totalPages: Math.ceil(totalCount / limit),
            },
        };
    }

    /**
     * Mark as contacted (admin)
     */
    async markAsContacted(requestId: string, notes?: string) {
        const request = await this.databaseService.communityJoinRequest.findUnique({
            where: { id: requestId },
        });

        if (!request) {
            throw new NotFoundException('Request not found');
        }

        const updated = await this.databaseService.communityJoinRequest.update({
            where: { id: requestId },
            data: {
                contacted: true,
                contactedAt: new Date(),
                notes: notes ?? null,
            },
        });

        this.logger.log(`Community join request ${requestId} marked as contacted`);
        return updated;
    }

    /**
     * Update notes (admin)
     */
    async updateNotes(requestId: string, notes: string) {
        const request = await this.databaseService.communityJoinRequest.findUnique({
            where: { id: requestId },
        });

        if (!request) {
            throw new NotFoundException('Request not found');
        }

        return this.databaseService.communityJoinRequest.update({
            where: { id: requestId },
            data: { notes },
        });
    }

    /**
     * Delete join request (admin)
     */
    async deleteRequest(requestId: string) {
        const request = await this.databaseService.communityJoinRequest.findUnique({
            where: { id: requestId },
        });

        if (!request) {
            throw new NotFoundException('Request not found');
        }

        return this.databaseService.communityJoinRequest.delete({
            where: { id: requestId },
        });
    }

    /**
     * Get community statistics (admin)
     */
    async getCommunityStats() {
        const [contacted, pending, total] = await Promise.all([
            this.databaseService.communityJoinRequest.count({ where: { contacted: true } }),
            this.databaseService.communityJoinRequest.count({ where: { contacted: false } }),
            this.databaseService.communityJoinRequest.count(),
        ]);

        return {
            contacted,
            pending,
            total,
        };
    }
}
