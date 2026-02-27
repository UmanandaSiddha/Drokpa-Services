import {
    Controller, Post, Get, Patch, Delete,
    Body, Param, Query, UseGuards,
    ParseBoolPipe,
} from '@nestjs/common';
import { CouponService } from './coupon.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { AssignCouponDto } from './dto/assign-coupon.dto';
import { ValidateCouponDto } from './dto/validate-coupon.dto';
import { AuthGuard, getUser } from 'src/modules/auth/guards/auth.guard';
import { RoleGuard } from 'src/modules/auth/guards/role.guard';
import { Roles } from 'src/modules/auth/decorator/role.decorator';
import { UserRole, CouponVisibility } from 'generated/prisma/enums';

/** UserRoleMap shape returned by @getUser('roles') */
type UserRoleMap = { role: UserRole; id: string };

/** Extract UserRole[] from the UserRoleMap[] that SafeUser carries */
function extractRoles(roleMaps: UserRoleMap[] | undefined): UserRole[] {
    if (!Array.isArray(roleMaps)) return [];
    return roleMaps.map(r => r.role);
}

@Controller('coupon')
export class CouponController {
    constructor(private readonly couponService: CouponService) { }

    // ─────────────────────────────────────────
    // Admin — CRUD
    // ─────────────────────────────────────────

    /** Create a new coupon */
    @Post('admin')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    create(
        @Body() dto: CreateCouponDto,
        @getUser('id') adminId: string,
    ) {
        return this.couponService.createCoupon(dto, adminId);
    }

    /** List all coupons with optional filters */
    @Get('admin')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    listAll(
        @Query('visibility') visibility?: CouponVisibility,
        @Query('isActive', new ParseBoolPipe({ optional: true })) isActive?: boolean,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.couponService.listCoupons({
            visibility,
            isActive,
            page: page ? parseInt(page) : undefined,
            limit: limit ? parseInt(limit) : undefined,
        });
    }

    /** Get a single coupon by ID */
    @Get('admin/:id')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    getOne(@Param('id') id: string) {
        return this.couponService.getCoupon(id);
    }

    /** Update coupon fields */
    @Patch('admin/:id')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    update(@Param('id') id: string, @Body() dto: UpdateCouponDto) {
        return this.couponService.updateCoupon(id, dto);
    }

    /** Delete a coupon (only safe if it has no usages — Prisma will block otherwise) */
    @Delete('admin/:id')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    remove(@Param('id') id: string) {
        return this.couponService.deleteCoupon(id);
    }

    // ─────────────────────────────────────────
    // Admin — User Assignments
    // ─────────────────────────────────────────

    /** Assign a coupon to specific users (for private/loyalty coupons) */
    @Post('admin/:id/assign')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    assignToUsers(
        @Param('id') couponId: string,
        @Body() dto: AssignCouponDto,
    ) {
        return this.couponService.assignToUsers(couponId, dto);
    }

    /** Revoke a coupon assignment from a specific user */
    @Delete('admin/:id/assign/:userId')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    revokeFromUser(
        @Param('id') couponId: string,
        @Param('userId') userId: string,
    ) {
        return this.couponService.revokeFromUser(couponId, userId);
    }

    /** View all usage records for a coupon */
    @Get('admin/:id/usages')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    getCouponUsages(@Param('id') id: string) {
        return this.couponService.getCouponUsages(id);
    }

    // ─────────────────────────────────────────
    // User — Discover & Validate
    // ─────────────────────────────────────────

    /**
     * Pre-checkout coupon validation. Returns the computed discount
     * amount so the frontend can show the updated total before booking.
     * Does NOT record usage — that happens inside the booking flow.
     */
    @Post('validate')
    @UseGuards(AuthGuard)
    async validate(
        @Body() dto: ValidateCouponDto,
        @getUser('id') userId: string,
        @getUser('roles') roleMaps: UserRoleMap[],
    ) {
        const result = await this.couponService.validateAndCompute(dto.code, {
            userId,
            userRoles: extractRoles(roleMaps),
            orderAmount: dto.orderAmount,
            participants: dto.participants,
        });

        return {
            valid: true,
            couponCode: result.couponCode,
            discountAmount: result.discountAmount,
            finalAmount: dto.orderAmount - result.discountAmount,
        };
    }

    /**
     * Return publicly available coupons (for promotions banner / coupon wallet)
     */
    @Get('public')
    @UseGuards(AuthGuard)
    getPublicCoupons(
        @getUser('id') userId: string,
        @getUser('roles') roleMaps: UserRoleMap[],
    ) {
        return this.couponService.getAvailablePublicCoupons(userId, extractRoles(roleMaps));
    }

    /**
     * Return coupons privately assigned to the logged-in user
     */
    @Get('my-coupons')
    @UseGuards(AuthGuard)
    getMyCoupons(@getUser('id') userId: string) {
        return this.couponService.getMyCoupons(userId);
    }
}
