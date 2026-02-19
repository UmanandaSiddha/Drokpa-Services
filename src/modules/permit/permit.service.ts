import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from 'src/services/database/database.service';
import { SubmitPermitDto } from './dto/submit-permit.dto';
import { PermitStatus } from 'generated/prisma/enums';

@Injectable()
export class PermitService {
    constructor(private readonly databaseService: DatabaseService) { }

    // ─────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────

    /**
     * Verifies the permit exists and optionally that it belongs to the given user.
     * Separates existence (404) from ownership (403).
     */
    private async findPermitWithOwnership(permitId: string, userId?: string) {
        const permit = await this.databaseService.permit.findUnique({
            where: { id: permitId },
            include: {
                bookingItem: {
                    include: { booking: { select: { userId: true } } },
                },
            },
        });

        if (!permit) throw new NotFoundException('Permit not found');

        if (userId && permit.bookingItem?.booking.userId !== userId) {
            throw new ForbiddenException('You do not have access to this permit');
        }

        return permit;
    }

    // ─────────────────────────────────────────
    // Submit (User action)
    // ─────────────────────────────────────────

    async submitPermit(permitId: string, userId: string, dto: SubmitPermitDto) {
        const permit = await this.findPermitWithOwnership(permitId, userId);

        // Allow submission from REQUIRED or COLLECTING_DOCS —
        // not all permits advance to COLLECTING_DOCS at booking time
        const submittableStatuses = [
            PermitStatus.REQUIRED,
            PermitStatus.COLLECTING_DOCS,
        ] as const;
        if (!submittableStatuses.includes(permit.status as typeof submittableStatuses[number])) {
            throw new BadRequestException(
                `Permit cannot be submitted from status: ${permit.status}`,
            );
        }

        // Merge incoming docs with any already stored on the permit
        const passportPhotoId = dto.passportPhotoId ?? permit.passportPhotoId;
        const identityProofId = dto.identityProofId ?? permit.identityProofId;

        // Both documents are mandatory before submission
        if (!passportPhotoId || !identityProofId) {
            throw new BadRequestException(
                'Both passport photo and identity proof are required before submission',
            );
        }

        return this.databaseService.permit.update({
            where: { id: permitId },
            data: {
                status: PermitStatus.SUBMITTED,
                submittedAt: new Date(),
                passportPhotoId,
                identityProofId,
            },
            include: {
                participant: true,
                passportPhoto: true,
                identityProof: true,
            },
        });
    }

    // ─────────────────────────────────────────
    // Get single permit
    // ─────────────────────────────────────────

    async getPermit(id: string, userId?: string) {
        const permit = await this.databaseService.permit.findUnique({
            where: { id },
            include: {
                participant: true,
                bookingItem: {
                    include: { booking: { select: { userId: true } } },
                },
                passportPhoto: true,
                identityProof: true,
                permitDocument: true,
            },
        });

        if (!permit) throw new NotFoundException('Permit not found');

        // If userId provided (non-admin caller), verify ownership
        if (userId && permit.bookingItem?.booking.userId !== userId) {
            throw new ForbiddenException('You do not have access to this permit');
        }

        return permit;
    }

    // ─────────────────────────────────────────
    // Get permits by booking
    // ─────────────────────────────────────────

    async getPermitsByBooking(bookingId: string, userId?: string) {
        // Ownership check if non-admin caller
        if (userId) {
            const booking = await this.databaseService.booking.findUnique({
                where: { id: bookingId },
                select: { userId: true },
            });
            if (!booking) throw new NotFoundException('Booking not found');
            if (booking.userId !== userId) {
                throw new ForbiddenException('You do not have access to this booking');
            }
        }

        // Single query via relation — no need to fetch booking items separately
        return this.databaseService.permit.findMany({
            where: {
                bookingItem: { bookingId },
            },
            include: {
                participant: true,
                passportPhoto: true,
                identityProof: true,
                permitDocument: true,
            },
        });
    }

    // ─────────────────────────────────────────
    // Approve (Admin action)
    // ─────────────────────────────────────────

    async approvePermit(id: string, permitDocumentId?: string) {
        const permit = await this.databaseService.permit.findUnique({
            where: { id },
        });

        if (!permit) throw new NotFoundException('Permit not found');

        if (permit.status !== PermitStatus.SUBMITTED) {
            throw new BadRequestException(
                'Permit must be in SUBMITTED status before approval',
            );
        }

        // NOTE: Supporting documents (passportPhoto, identityProof) are intentionally
        // retained after approval for audit purposes. Cleanup should be handled by a
        // scheduled job with a defined retention policy, not here.
        return this.databaseService.permit.update({
            where: { id },
            data: {
                status: PermitStatus.APPROVED,
                approvedAt: new Date(),
                ...(permitDocumentId && { permitDocumentId }),
            },
            include: {
                participant: true,
                permitDocument: true,
            },
        });
    }

    // ─────────────────────────────────────────
    // Reject (Admin action)
    // ─────────────────────────────────────────

    async rejectPermit(id: string, reason: string) {
        const permit = await this.databaseService.permit.findUnique({
            where: { id },
        });

        if (!permit) throw new NotFoundException('Permit not found');

        if (!reason?.trim()) {
            throw new BadRequestException('Rejection reason is required');
        }

        // Allow rejection from SUBMITTED or COLLECTING_DOCS —
        // admin may need to reject a stalled permit
        const rejectableStatuses = [
            PermitStatus.SUBMITTED,
            PermitStatus.COLLECTING_DOCS,
        ] as const;
        if (!rejectableStatuses.includes(permit.status as typeof rejectableStatuses[number])) {
            throw new BadRequestException(
                `Permit cannot be rejected from status: ${permit.status}`,
            );
        }

        return this.databaseService.permit.update({
            where: { id },
            data: {
                status: PermitStatus.REJECTED,
                rejectedAt: new Date(),
                rejectionReason: reason.trim(),
            },
        });
    }

    // ─────────────────────────────────────────
    // Upload permit document (Admin action — attaches approved ILP document)
    // ─────────────────────────────────────────

    async uploadPermitDocument(permitId: string, documentId: string) {
        const permit = await this.databaseService.permit.findUnique({
            where: { id: permitId },
            select: { id: true, status: true },
        });

        if (!permit) throw new NotFoundException('Permit not found');

        // Document can only be attached to an approved permit
        if (permit.status !== PermitStatus.APPROVED) {
            throw new BadRequestException(
                'Permit document can only be attached to an approved permit',
            );
        }

        const document = await this.databaseService.document.findUnique({
            where: { id: documentId },
            select: { id: true },
        });
        if (!document) {
            throw new NotFoundException(`Document ${documentId} not found`);
        }

        return this.databaseService.permit.update({
            where: { id: permitId },
            data: { permitDocumentId: documentId },
            include: { permitDocument: true },
        });
    }
}