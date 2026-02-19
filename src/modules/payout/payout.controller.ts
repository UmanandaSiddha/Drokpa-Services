import {
    Controller, Post, Get, Patch,
    Body, Param, Query, UseGuards,
    ParseEnumPipe,
} from '@nestjs/common';
import { PayoutService } from './payout.service';
import { AuthGuard, getUser } from 'src/modules/auth/guards/auth.guard';
import { RoleGuard } from 'src/modules/auth/guards/role.guard';
import { Roles } from 'src/modules/auth/decorator/role.decorator';
import { UserRole, PayoutStatus } from 'generated/prisma/enums';
import { QueryString } from 'src/utils/apiFeatures';
import { CreatePayoutDto } from './dto/create-payout.dto';

@Controller('payout')
@UseGuards(AuthGuard)
export class PayoutController {
    constructor(private readonly payoutService: PayoutService) { }

    // ── Provider endpoints ────────────────────

    /**
     * Provider views their own payouts with summary stats.
     * GET /payout/my-payouts
     */
    @Get('my-payouts')
    @UseGuards(RoleGuard)
    @Roles(UserRole.HOST, UserRole.VENDOR, UserRole.GUIDE)
    getMyPayouts(
        @getUser('id') userId: string,
        @Query() query: QueryString,
    ) {
        // Service will look up provider from userId
        return this.payoutService.getMyPayouts(userId, query);
    }

    // ── Admin endpoints ───────────────────────

    /**
     * Create a payout record for a completed booking.
     * POST /payout
     */
    @Post()
    @UseGuards(RoleGuard)
    @Roles(UserRole.ADMIN)
    createPayout(@Body() dto: CreatePayoutDto) {
        return this.payoutService.createPayout(dto);
    }

    /**
     * Get all payouts (paginated, filterable by status).
     * GET /payout/admin/all
     */
    @Get('admin/all')
    @UseGuards(RoleGuard)
    @Roles(UserRole.ADMIN)
    getAllPayouts(
        @Query() query: QueryString,
        @Query('status', new ParseEnumPipe(PayoutStatus, { optional: true }))
        status?: PayoutStatus,
    ) {
        return this.payoutService.getAllPayouts(query, status);
    }

    /**
     * Get all payouts for a specific provider (admin view).
     * GET /payout/admin/provider/:providerId
     */
    @Get('admin/provider/:providerId')
    @UseGuards(RoleGuard)
    @Roles(UserRole.ADMIN)
    getProviderPayouts(
        @Param('providerId') providerId: string,
        @Query() query: QueryString,
    ) {
        return this.payoutService.getProviderPayouts(providerId, query);
    }

    /**
     * Initiate payout — mark as processing when bank transfer is started.
     * PATCH /payout/:id/processing
     */
    @Patch(':id/processing')
    @UseGuards(RoleGuard)
    @Roles(UserRole.ADMIN)
    markProcessing(@Param('id') id: string) {
        return this.payoutService.markProcessing(id);
    }

    /**
     * Confirm payout — mark as completed.
     * PATCH /payout/:id/complete
     */
    @Patch(':id/complete')
    @UseGuards(RoleGuard)
    @Roles(UserRole.ADMIN)
    markCompleted(@Param('id') id: string) {
        return this.payoutService.markCompleted(id);
    }

    /**
     * Mark payout as failed.
     * PATCH /payout/:id/fail
     */
    @Patch(':id/fail')
    @UseGuards(RoleGuard)
    @Roles(UserRole.ADMIN)
    markFailed(@Param('id') id: string) {
        return this.payoutService.markFailed(id);
    }

    // ── Shared (Admin or owning Provider) ─────

    /**
     * Get single payout by ID.
     * Providers can only view their own payouts.
     * GET /payout/:id
     */
    @Get(':id')
    getPayout(
        @Param('id') id: string,
        @getUser('id') userId: string,
    ) {
        // Service handles authorization — admins can view all, providers see their own
        return this.payoutService.getPayout(id, userId);
    }
}