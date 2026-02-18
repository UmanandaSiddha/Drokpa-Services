import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from 'src/services/database/database.service';
import { SubmitPermitDto } from './dto/submit-permit.dto';
import { PermitStatus } from 'generated/prisma/enums';

@Injectable()
export class PermitService {
    constructor(
        private readonly databaseService: DatabaseService,
    ) { }

    async submitPermit(permitId: string, dto: SubmitPermitDto) {
        const permit = await this.databaseService.permit.findUnique({
            where: { id: permitId },
        });

        if (!permit) {
            throw new NotFoundException('Permit not found');
        }

        if (permit.status !== PermitStatus.COLLECTING_DOCS) {
            throw new BadRequestException('Permit is not in collecting docs status');
        }

        return this.databaseService.permit.update({
            where: { id: permitId },
            data: {
                status: PermitStatus.SUBMITTED,
                submittedAt: new Date(),
                ...(dto.passportPhotoId && { passportPhotoId: dto.passportPhotoId }),
                ...(dto.identityProofId && { identityProofId: dto.identityProofId }),
            },
        });
    }

    async getPermit(id: string) {
        const permit = await this.databaseService.permit.findUnique({
            where: { id },
            include: {
                participant: true,
                bookingItem: true,
                passportPhoto: true,
                identityProof: true,
                permitDocument: true,
            },
        });

        if (!permit) {
            throw new NotFoundException('Permit not found');
        }

        return permit;
    }

    async approvePermit(id: string, permitDocumentId?: string) {
        const permit = await this.databaseService.permit.findUnique({
            where: { id },
        });

        if (!permit) {
            throw new NotFoundException('Permit not found');
        }

        if (permit.status !== PermitStatus.SUBMITTED) {
            throw new BadRequestException('Permit must be submitted before approval');
        }

        return this.databaseService.$transaction(async tx => {
            const updatedPermit = await tx.permit.update({
                where: { id },
                data: {
                    status: PermitStatus.APPROVED,
                    approvedAt: new Date(),
                    ...(permitDocumentId && { permitDocumentId }),
                },
            });

            // Delete user documents after approval
            if (permit.passportPhotoId) {
                await tx.document.update({
                    where: { id: permit.passportPhotoId },
                    data: { deletedAt: new Date() },
                });
            }

            if (permit.identityProofId) {
                await tx.document.update({
                    where: { id: permit.identityProofId },
                    data: { deletedAt: new Date() },
                });
            }

            return updatedPermit;
        });
    }

    async rejectPermit(id: string, reason: string) {
        const permit = await this.databaseService.permit.findUnique({
            where: { id },
        });

        if (!permit) {
            throw new NotFoundException('Permit not found');
        }

        if (!reason?.trim()) {
            throw new BadRequestException('Rejection reason is required');
        }

        return this.databaseService.permit.update({
            where: { id },
            data: {
                status: PermitStatus.REJECTED,
                rejectedAt: new Date(),
                rejectionReason: reason,
            },
        });
    }

    async uploadPermitDocument(permitId: string, documentId: string) {
        const permit = await this.databaseService.permit.findUnique({
            where: { id: permitId },
        });

        if (!permit) {
            throw new NotFoundException('Permit not found');
        }

        if (!documentId?.trim()) {
            throw new BadRequestException('Document ID is required');
        }

        return this.databaseService.permit.update({
            where: { id: permitId },
            data: {
                permitDocumentId: documentId,
            },
        });
    }

    async getPermitsByBooking(bookingId: string) {
        const booking = await this.databaseService.booking.findUnique({
            where: { id: bookingId },
            include: {
                items: true,
            },
        });

        if (!booking) {
            throw new NotFoundException('Booking not found');
        }

        const itemIds = booking.items.map(item => item.id);

        return this.databaseService.permit.findMany({
            where: {
                bookingItemId: {
                    in: itemIds,
                },
            },
            include: {
                participant: true,
                passportPhoto: true,
                identityProof: true,
                permitDocument: true,
            },
        });
    }
}
