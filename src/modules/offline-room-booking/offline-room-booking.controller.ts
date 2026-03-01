import {
    Controller,
    Post,
    Get,
    Patch,
    Delete,
    Body,
    Param,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { OfflineRoomBookingService } from './offline-room-booking.service';
import { CreateOfflineBookingDto } from './dto/create-offline-booking.dto';
import { UpdateOfflineBookingDto } from './dto/update-offline-booking.dto';
import { AuthGuard, getUser } from 'src/modules/auth/guards/auth.guard';
import { RoleGuard } from 'src/modules/auth/guards/role.guard';
import { Roles } from 'src/modules/auth/decorator/role.decorator';
import { UserRole } from 'generated/prisma/enums';

@Controller('rooms/:roomId/offline-bookings')
@UseGuards(AuthGuard, RoleGuard)
@Roles(UserRole.HOST, UserRole.ADMIN)
export class OfflineRoomBookingController {
    constructor(
        private readonly offlineRoomBookingService: OfflineRoomBookingService,
    ) { }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    async createOfflineBooking(
        @Param('roomId') roomId: string,
        @Body() dto: CreateOfflineBookingDto,
        @getUser('providerId') providerId: string,
        @getUser('roles') userRoles: { role: UserRole }[],
    ) {
        const isAdmin = userRoles.some(r => r.role === UserRole.ADMIN);
        return this.offlineRoomBookingService.createOfflineBooking(
            roomId,
            providerId,
            dto,
            isAdmin,
        );
    }

    @Get()
    async getOfflineBookingsForRoom(
        @Param('roomId') roomId: string,
        @getUser('providerId') providerId: string,
        @getUser('roles') userRoles: { role: UserRole }[],
    ) {
        const isAdmin = userRoles.some(r => r.role === UserRole.ADMIN);
        return this.offlineRoomBookingService.getOfflineBookingsForRoom(
            roomId,
            providerId,
            isAdmin,
        );
    }

    @Patch(':bookingId')
    async updateOfflineBooking(
        @Param('roomId') roomId: string,
        @Param('bookingId') bookingId: string,
        @Body() dto: UpdateOfflineBookingDto,
        @getUser('providerId') providerId: string,
        @getUser('roles') userRoles: { role: UserRole }[],
    ) {
        const isAdmin = userRoles.some(r => r.role === UserRole.ADMIN);
        return this.offlineRoomBookingService.updateOfflineBooking(
            bookingId,
            roomId,
            providerId,
            dto,
            isAdmin,
        );
    }

    @Delete(':bookingId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteOfflineBooking(
        @Param('roomId') roomId: string,
        @Param('bookingId') bookingId: string,
        @getUser('providerId') providerId: string,
        @getUser('roles') userRoles: { role: UserRole }[],
    ) {
        const isAdmin = userRoles.some(r => r.role === UserRole.ADMIN);
        return this.offlineRoomBookingService.deleteOfflineBooking(
            bookingId,
            roomId,
            providerId,
            isAdmin,
        );
    }
}
