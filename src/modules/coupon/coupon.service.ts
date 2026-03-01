import {
    Injectable,
    BadRequestException,
    NotFoundException,
    ForbiddenException,
    ConflictException,
} from '@nestjs/common';
import { DatabaseService } from 'src/services/database/database.service';
import { LoggerService } from 'src/services/logger/logger.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { AssignCouponDto } from './dto/assign-coupon.dto';
import {
    CouponType,
    CouponVisibility,
    CouponApplyTo,
    UserRole,
} from 'generated/prisma/enums';

/**
 * Result of a successful coupon validation.
 * The caller (booking service) is responsible for recording the usage.
 */
export interface CouponValidationResult {
    couponId: string;
    couponCode: string;
    discountAmount: number; // Concrete rupee amount saved
}

/** Contextual information needed to validate coupon eligibility */
export interface CouponValidationContext {
    userId: string;
    userRoles: UserRole[];
    orderAmount: number; // Gross booking total (before discount)
    participants?: number; // Number of guests / participants
    productType?: string; // ProviderType string
    productId?: string;
}

@Injectable()
export class CouponService {
    private readonly logger = new LoggerService(CouponService.name);

    constructor(private readonly databaseService: DatabaseService) { }

    // ─────────────────────────────────────────
    // Admin CRUD
    // ─────────────────────────────────────────

    async createCoupon(dto: CreateCouponDto, createdBy: string) {
        const code = dto.code.toUpperCase().trim();

        const existing = await this.databaseService.coupon.findUnique({
            where: { code },
        });
        if (existing) {
            throw new ConflictException(`Coupon code "${code}" already exists`);
        }

        return this.databaseService.coupon.create({
            data: {
                code,
                description: dto.description,
                type: dto.type,
                visibility: dto.visibility,
                applyTo: dto.applyTo ?? CouponApplyTo.BOOKING_TOTAL,
                discountValue: dto.discountValue,
                maxDiscountAmount: dto.maxDiscountAmount,
                minOrderAmount: dto.minOrderAmount,
                validFrom: new Date(dto.validFrom),
                validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
                maxUsesTotal: dto.maxUsesTotal,
                maxUsesPerUser: dto.maxUsesPerUser,
                allowedRoles: dto.allowedRoles ?? [],
                minParticipants: dto.minParticipants,
                applicableProductTypes: dto.applicableProductTypes ?? [],
                applicableProductIds: dto.applicableProductIds ?? [],
                firstTimeOnly: dto.firstTimeOnly ?? false,
                rules: dto.rules ?? null,
                isActive: dto.isActive ?? true,
                createdBy,
            },
        });
    }

    async updateCoupon(id: string, dto: UpdateCouponDto) {
        await this.findCouponOrThrow(id);

        // Cast to any to safely access PartialType properties — all writes go through prisma.update data
        const raw = dto as any;
        const updateData: any = { ...raw };

        if (raw.code) {
            updateData.code = (raw.code as string).toUpperCase().trim();
        }
        if (raw.validFrom) {
            updateData.validFrom = new Date(raw.validFrom);
        }
        if (raw.validUntil) {
            updateData.validUntil = new Date(raw.validUntil);
        }

        return this.databaseService.coupon.update({
            where: { id },
            data: updateData,
        });
    }

    async deleteCoupon(id: string) {
        await this.findCouponOrThrow(id);
        try {
            return await this.databaseService.coupon.delete({ where: { id } });
        } catch (err: any) {
            // Prisma FK constraint violation — usages exist
            if (err?.code === 'P2003' || err?.code === 'P2014') {
                throw new ConflictException(
                    'Cannot delete this coupon because it has been used in bookings. ' +
                    'Deactivate it instead by setting isActive=false.',
                );
            }
            throw err;
        }
    }

    async getCoupon(id: string) {
        return this.findCouponOrThrow(id);
    }

    async listCoupons(filters?: {
        visibility?: CouponVisibility;
        isActive?: boolean;
        page?: number;
        limit?: number;
    }) {
        const page = filters?.page ?? 1;
        const limit = filters?.limit ?? 20;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (filters?.visibility !== undefined) where.visibility = filters.visibility;
        if (filters?.isActive !== undefined) where.isActive = filters.isActive;

        const [data, total] = await Promise.all([
            this.databaseService.coupon.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    _count: { select: { usages: true, userAssignments: true } },
                },
            }),
            this.databaseService.coupon.count({ where }),
        ]);

        return {
            data,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        };
    }

    /**
     * Assign a private coupon to one or more specific users.
     * Skips (doesn't throw) if user is already assigned.
     */
    async assignToUsers(couponId: string, dto: AssignCouponDto) {
        const coupon = await this.findCouponOrThrow(couponId);

        const results = await Promise.allSettled(
            dto.userIds.map(userId =>
                this.databaseService.couponUserAssignment.upsert({
                    where: { couponId_userId: { couponId, userId } },
                    update: { note: dto.note },
                    create: { couponId, userId, note: dto.note },
                }),
            ),
        );

        const assigned = results.filter(r => r.status === 'fulfilled').length;
        return { assigned, couponCode: coupon.code };
    }

    async revokeFromUser(couponId: string, userId: string) {
        await this.findCouponOrThrow(couponId);
        const assignment = await this.databaseService.couponUserAssignment.findUnique({
            where: { couponId_userId: { couponId, userId } },
        });
        if (!assignment) {
            throw new NotFoundException('Assignment not found');
        }
        return this.databaseService.couponUserAssignment.delete({
            where: { couponId_userId: { couponId, userId } },
        });
    }

    async getCouponUsages(couponId: string) {
        await this.findCouponOrThrow(couponId);
        return this.databaseService.couponUsage.findMany({
            where: { couponId },
            include: {
                user: { select: { id: true, email: true, firstName: true, lastName: true } },
            },
            orderBy: { redeemedAt: 'desc' },
        });
    }

    // ─────────────────────────────────────────
    // Public — coupon lookup for user wallet
    // ─────────────────────────────────────────

    /** Return non-sensitive info about public coupons available to a user */
    async getAvailablePublicCoupons(userId: string, userRoles: UserRole[]) {
        const now = new Date();
        // Note: we fetch all active, non-expired public coupons and let DB handle
        // maxUsesTotal filtering via Prisma where. Field-level comparison uses
        // a raw filter because Prisma doesn't support column-to-column comparison.
        const all = await this.databaseService.coupon.findMany({
            where: {
                isActive: true,
                visibility: CouponVisibility.PUBLIC,
                validFrom: { lte: now },
                OR: [
                    { validUntil: null },
                    { validUntil: { gte: now } },
                ],
            },
            select: {
                id: true,
                code: true,
                description: true,
                type: true,
                discountValue: true,
                maxDiscountAmount: true,
                applyTo: true,
                minOrderAmount: true,
                validUntil: true,
                allowedRoles: true,
                minParticipants: true,
                applicableProductTypes: true,
                applicableProductIds: true,
                firstTimeOnly: true,
                rules: true,
                maxUsesTotal: true,
                currentUses: true,
            },
        });

        // Filter out exhausted coupons (column-level check done in app code)
        return all.filter(c => c.maxUsesTotal === null || c.currentUses < c.maxUsesTotal);
    }

    /**
     * Return coupons explicitly assigned to a user (private assignments)
     */
    async getMyCoupons(userId: string) {
        return this.databaseService.couponUserAssignment.findMany({
            where: { userId },
            include: {
                coupon: {
                    select: {
                        id: true,
                        code: true,
                        description: true,
                        type: true,
                        discountValue: true,
                        maxDiscountAmount: true,
                        applyTo: true,
                        minOrderAmount: true,
                        validFrom: true,
                        validUntil: true,
                        isActive: true,
                        minParticipants: true,
                        applicableProductTypes: true,
                        applicableProductIds: true,
                        firstTimeOnly: true,
                        rules: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    // ─────────────────────────────────────────
    // Core Validation Engine
    // ─────────────────────────────────────────

    /**
     * Validate a coupon code against the full rule-set and compute
     * the concrete rupee discount. Throws BadRequestException / ForbiddenException
     * on any violation so the caller can surface it directly to the user.
     *
     * Does NOT record usage — call `recordUsage()` after the booking is persisted.
     */
    async validateAndCompute(
        code: string,
        ctx: CouponValidationContext,
    ): Promise<CouponValidationResult> {
        const normalizedCode = code.toUpperCase().trim();

        const coupon = await this.databaseService.coupon.findUnique({
            where: { code: normalizedCode },
            include: {
                userAssignments: {
                    where: { userId: ctx.userId },
                    select: { id: true },
                },
            },
        });

        if (!coupon || !coupon.isActive) {
            throw new BadRequestException(`Coupon "${normalizedCode}" is not valid`);
        }

        // ── Date window ──────────────────────────────────────────────────────
        const now = new Date();
        if (coupon.validFrom > now) {
            throw new BadRequestException(`Coupon "${normalizedCode}" is not yet active`);
        }
        if (coupon.validUntil && coupon.validUntil < now) {
            throw new BadRequestException(`Coupon "${normalizedCode}" has expired`);
        }

        // ── Total uses cap ───────────────────────────────────────────────────
        if (coupon.maxUsesTotal !== null && coupon.currentUses >= coupon.maxUsesTotal) {
            throw new BadRequestException(`Coupon "${normalizedCode}" has reached its usage limit`);
        }

        // ── Minimum order amount ─────────────────────────────────────────────
        if (coupon.minOrderAmount !== null && ctx.orderAmount < coupon.minOrderAmount) {
            throw new BadRequestException(
                `A minimum order of ₹${coupon.minOrderAmount} is required to use this coupon`,
            );
        }

        // ── Visibility / access control ──────────────────────────────────────
        if (coupon.visibility === CouponVisibility.PRIVATE) {
            const hasRoleAccess =
                coupon.allowedRoles.length > 0 &&
                coupon.allowedRoles.some(r => ctx.userRoles.includes(r));
            const isUserAssigned = coupon.userAssignments.length > 0;

            if (!hasRoleAccess && !isUserAssigned) {
                // Deliberately vague — don't confirm the coupon exists for unauthorised users
                throw new ForbiddenException(`Coupon "${normalizedCode}" is not available to you`);
            }
        }

        // ── Role restriction on public coupons ───────────────────────────────
        // allowedRoles on a PUBLIC coupon acts as an additional restriction
        if (
            coupon.visibility === CouponVisibility.PUBLIC &&
            coupon.allowedRoles.length > 0 &&
            !coupon.allowedRoles.some(r => ctx.userRoles.includes(r))
        ) {
            throw new ForbiddenException(`Coupon "${normalizedCode}" is restricted to specific user roles`);
        }

        // ── Per-user usage cap ───────────────────────────────────────────────
        if (coupon.maxUsesPerUser !== null) {
            const userUsages = await this.databaseService.couponUsage.count({
                where: { couponId: coupon.id, userId: ctx.userId },
            });
            if (userUsages >= coupon.maxUsesPerUser) {
                throw new BadRequestException(
                    `You have already used coupon "${normalizedCode}" the maximum allowed times`,
                );
            }
        }

        // ── Business Rules Validation ────────────────────────────────────────

        // Rule: minParticipants — for group discounts on tours
        if (coupon.minParticipants !== null) {
            const participants = ctx.participants ?? 1;
            if (participants < coupon.minParticipants) {
                throw new BadRequestException(
                    `This coupon requires a minimum of ${coupon.minParticipants} participants`,
                );
            }
        }

        // Rule: applicableProductTypes — restrict to certain ProviderTypes
        if (coupon.applicableProductTypes.length > 0 && ctx.productType) {
            if (!coupon.applicableProductTypes.includes(ctx.productType)) {
                throw new BadRequestException(
                    `Coupon "${normalizedCode}" is not applicable to this type of booking`,
                );
            }
        }

        // Rule: applicableProductIds — restrict to specific products
        if (coupon.applicableProductIds.length > 0 && ctx.productId) {
            if (!coupon.applicableProductIds.includes(ctx.productId)) {
                throw new BadRequestException(
                    `Coupon "${normalizedCode}" is not applicable to this specific product`,
                );
            }
        }

        // Rule: firstTimeOnly — user must have zero prior completed bookings
        if (coupon.firstTimeOnly === true) {
            const priorCount = await this.databaseService.booking.count({
                where: {
                    userId: ctx.userId,
                    status: { in: ['CONFIRMED', 'COMPLETED'] as any },
                },
            });
            if (priorCount > 0) {
                throw new BadRequestException(
                    `Coupon "${normalizedCode}" is only available for first-time bookings`,
                );
            }
        }

        // ── Legacy JSON rules (for backward compatibility or future expansion) ──
        const rules = coupon.rules as Record<string, any> | null;
        // Add any additional custom rule checks here if needed

        // ── Compute discount ─────────────────────────────────────────────────
        const discountAmount = this.computeDiscount(coupon, ctx);

        return {
            couponId: coupon.id,
            couponCode: coupon.code,
            discountAmount,
        };
    }

    /**
     * Compute the concrete rupee discount for a validated coupon.
     * Returns 0 if the result would be negative (safety guard).
     */
    private computeDiscount(
        coupon: {
            type: CouponType;
            discountValue: number;
            maxDiscountAmount: number | null;
            applyTo: CouponApplyTo;
        },
        ctx: CouponValidationContext,
    ): number {
        let raw: number;

        if (coupon.type === CouponType.PERCENTAGE) {
            const base =
                coupon.applyTo === CouponApplyTo.PER_PERSON
                    ? ctx.orderAmount / (ctx.participants ?? 1) // price per person
                    : ctx.orderAmount;

            raw = Math.floor((base * coupon.discountValue) / 100);

            // For PER_PERSON, multiply back by participants
            if (coupon.applyTo === CouponApplyTo.PER_PERSON) {
                raw = raw * (ctx.participants ?? 1);
            }
        } else {
            // FIXED_AMOUNT — applyTo is irrelevant
            raw = coupon.discountValue;
        }

        // Apply maxDiscountAmount cap
        if (coupon.maxDiscountAmount !== null) {
            raw = Math.min(raw, coupon.maxDiscountAmount);
        }

        // Discount can never exceed the order amount
        raw = Math.min(raw, ctx.orderAmount);

        return Math.max(0, raw);
    }

    /**
     * Record a coupon redemption after the booking is committed.
     * Also increments currentUses on the coupon.
     * Call this AFTER the booking transaction completes successfully.
     * Errors are logged but NOT re-thrown — a recording failure must
     * never roll back an already-committed booking.
     */
    async recordUsage(
        couponId: string,
        userId: string,
        bookingId: string,
        discountAmount: number,
    ): Promise<void> {
        try {
            await this.databaseService.$transaction(async tx => {
                await tx.couponUsage.create({
                    data: { couponId, userId, bookingId, discountAmount },
                });
                await tx.coupon.update({
                    where: { id: couponId },
                    data: { currentUses: { increment: 1 } },
                });
            });
        } catch (err: any) {
            // P2002 = unique constraint violation (duplicate bookingId) — safe to swallow
            if (err?.code === 'P2002') {
                this.logger.warn(`CouponUsage already recorded for booking ${bookingId} — skipping duplicate`);
                return;
            }
            // Any other error: log but do NOT throw — booking is already committed
            this.logger.error(
                `Failed to record coupon usage for booking ${bookingId}: ${err?.message ?? String(err)}`,
                err?.stack,
            );
        }
    }

    /**
     * Decrement currentUses when a booking that used a coupon is rejected or expired.
     * Floors at 0 to prevent negative counts caused by edge-case race conditions.
     * Errors are logged but NOT re-thrown — the booking state change is already committed.
     */
    async decrementCurrentUses(couponId: string): Promise<void> {
        try {
            // Use updateMany with a where filter so the floor of 0 is enforced at DB level
            await this.databaseService.coupon.updateMany({
                where: { id: couponId, currentUses: { gt: 0 } },
                data: { currentUses: { decrement: 1 } },
            });
        } catch (err: any) {
            this.logger.error(
                `Failed to decrement currentUses for coupon ${couponId}: ${err?.message ?? String(err)}`,
                err?.stack,
            );
        }
    }

    // ─────────────────────────────────────────
    // Private helpers
    // ─────────────────────────────────────────

    private async findCouponOrThrow(id: string) {
        const coupon = await this.databaseService.coupon.findUnique({
            where: { id },
        });
        if (!coupon) {
            throw new NotFoundException(`Coupon with ID "${id}" not found`);
        }
        return coupon;
    }
}
