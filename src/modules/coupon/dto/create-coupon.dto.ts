import {
    IsString, IsEnum, IsInt, IsOptional, IsBoolean,
    IsDateString, IsArray, Min, Max, MaxLength,
    IsPositive, ValidateIf, IsUUID,
} from 'class-validator';
import { CouponType, CouponVisibility, CouponApplyTo, UserRole } from 'generated/prisma/enums';

export class CreateCouponDto {
    @IsString()
    @MaxLength(30)
    code: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsEnum(CouponType)
    type: CouponType;

    @IsEnum(CouponVisibility)
    visibility: CouponVisibility;

    @IsEnum(CouponApplyTo)
    @IsOptional()
    applyTo?: CouponApplyTo;

    /** For PERCENTAGE: 1-100. For FIXED_AMOUNT: rupee value (>= 1). */
    @IsInt()
    @IsPositive()
    @ValidateIf(o => o.type === CouponType.PERCENTAGE)
    @Max(100)
    discountValue: number;

    /** Optional rupee ceiling on discount (e.g. 15% off but max ₹1000) */
    @IsOptional()
    @IsInt()
    @IsPositive()
    maxDiscountAmount?: number;

    /** Minimum booking total (pre-discount) to allow applying this coupon */
    @IsOptional()
    @IsInt()
    @Min(0)
    minOrderAmount?: number;

    @IsDateString()
    validFrom: string;

    @IsOptional()
    @IsDateString()
    validUntil?: string;

    /** Max total redemptions across all users. null = unlimited */
    @IsOptional()
    @IsInt()
    @IsPositive()
    maxUsesTotal?: number;

    /** Max redemptions per user. null = unlimited */
    @IsOptional()
    @IsInt()
    @IsPositive()
    maxUsesPerUser?: number;

    /**
     * Roles that may use this coupon. Empty array = no role restriction.
     * Example: ['ADMIN'] to create an internal/QA-only coupon.
     */
    @IsOptional()
    @IsArray()
    @IsEnum(UserRole, { each: true })
    allowedRoles?: UserRole[];

    /**
     * Flexible extra rules stored as JSON. Supported keys:
     *   - minParticipants: number       → group discount (only for tours with N+ guests)
     *   - applicableProductTypes: string[] → restrict to specific ProviderTypes
     *   - applicableProductIds: string[]  → restrict to specific product IDs
     *   - firstTimeOnly: boolean          → only on user's first booking
     */
    @IsOptional()
    rules?: Record<string, any>;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
