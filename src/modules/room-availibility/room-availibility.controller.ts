import {
    Controller, Post, Get, Patch, Delete,
    Body, Param, Query, UseGuards,
    BadRequestException,
} from '@nestjs/common';
import { AuthGuard, getUser } from 'src/modules/auth/guards/auth.guard';
import { RoleGuard } from 'src/modules/auth/guards/role.guard';
import { Roles } from 'src/modules/auth/decorator/role.decorator';
import { UserRole } from 'generated/prisma/enums';
import { RoomAvailabilityService } from './room-availibility.service';
import { SetAvailabilityDto } from './dto/set-availability.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';

@Controller('room-availability')
export class RoomAvailabilityController {
    constructor(private readonly roomAvailabilityService: RoomAvailabilityService) { }

    // ── Provider endpoints ────────────────────

    /**
     * Set availability for a date range.
     * Upserts — safe to call multiple times to adjust counts or prices.
     * POST /room-availability/:roomId
     */
    @Post(':roomId')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.HOST)
    setAvailability(
        @Param('roomId') roomId: string,
        @Body() dto: SetAvailabilityDto,
        @getUser('providerId') providerId: string,
    ) {
        return this.roomAvailabilityService.setAvailability(roomId, providerId, dto);
    }

    /**
     * Update a single date's availability or price.
     * PATCH /room-availability/:roomId/date
     */
    @Patch(':roomId/date')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.HOST)
    updateSingleDate(
        @Param('roomId') roomId: string,
        @Body() dto: UpdateAvailabilityDto,
        @getUser('providerId') providerId: string,
    ) {
        return this.roomAvailabilityService.updateSingleDate(roomId, providerId, dto);
    }

    /**
     * Block a date range — sets available = 0.
     * Use for maintenance, holds, or personal use.
     * POST /room-availability/:roomId/block
     */
    @Post(':roomId/block')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.HOST)
    blockDates(
        @Param('roomId') roomId: string,
        @Body() dto: Omit<SetAvailabilityDto, 'available'>,
        @getUser('providerId') providerId: string,
    ) {
        return this.roomAvailabilityService.blockDates(roomId, providerId, dto);
    }

    /**
     * Delete availability records for a date range entirely.
     * Different from blocking — removes the records rather than setting to 0.
     * DELETE /room-availability/:roomId?startDate=...&endDate=...
     */
    @Delete(':roomId')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.HOST)
    deleteAvailabilityRange(
        @Param('roomId') roomId: string,
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
        @getUser('providerId') providerId: string,
    ) {
        if (!startDate || !endDate) {
            throw new BadRequestException('startDate and endDate are required');
        }
        return this.roomAvailabilityService.deleteAvailabilityRange(
            roomId,
            providerId,
            startDate,
            endDate,
        );
    }

    /**
     * Get availability summary for all rooms in a homestay.
     * Provider dashboard calendar view.
     * GET /room-availability/homestay/:homestayId?startDate=...&endDate=...
     */
    @Get('homestay/:homestayId')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.HOST)
    getHomestayAvailabilitySummary(
        @Param('homestayId') homestayId: string,
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
        @getUser('providerId') providerId: string,
    ) {
        if (!startDate || !endDate) {
            throw new BadRequestException('startDate and endDate are required');
        }
        return this.roomAvailabilityService.getHomestayAvailabilitySummary(
            homestayId,
            providerId,
            startDate,
            endDate,
        );
    }

    // ── Public endpoints ──────────────────────

    /**
     * Get availability for a specific room over a date range.
     * Used by booking flow and frontend calendar.
     * GET /room-availability/:roomId?startDate=...&endDate=...
     */
    @Get(':roomId')
    getRoomAvailability(
        @Param('roomId') roomId: string,
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
    ) {
        if (!startDate || !endDate) {
            throw new BadRequestException('startDate and endDate are required');
        }
        return this.roomAvailabilityService.getRoomAvailability(roomId, startDate, endDate);
    }
}