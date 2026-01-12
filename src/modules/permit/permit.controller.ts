import { Controller, Post, Get, Put, Body, Param, UseGuards } from '@nestjs/common';
import { PermitService } from './permit.service';
import { SubmitPermitDto } from './dto/submit-permit.dto';
import { AuthGuard, getUser } from 'src/modules/auth/guards/auth.guard';
import { RoleGuard } from 'src/modules/auth/guards/role.guard';
import { Roles } from 'src/modules/auth/decorator/role.decorator';
import { UserRole } from 'generated/prisma/enums';

@Controller('permit')
@UseGuards(AuthGuard)
export class PermitController {
    constructor(private readonly permitService: PermitService) { }

    @Post(':id/submit')
    submitPermit(
        @Param('id') id: string,
        @Body() dto: SubmitPermitDto,
    ) {
        return this.permitService.submitPermit(id, dto);
    }

    @Get(':id')
    getPermit(@Param('id') id: string) {
        return this.permitService.getPermit(id);
    }

    @Put(':id/approve')
    @UseGuards(RoleGuard)
    @Roles(UserRole.ADMIN)
    approvePermit(
        @Param('id') id: string,
        @Body('permitDocumentId') permitDocumentId?: string,
    ) {
        return this.permitService.approvePermit(id, permitDocumentId);
    }

    @Put(':id/reject')
    @UseGuards(RoleGuard)
    @Roles(UserRole.ADMIN)
    rejectPermit(
        @Param('id') id: string,
        @Body('reason') reason: string,
    ) {
        return this.permitService.rejectPermit(id, reason);
    }

    @Post(':id/document')
    @UseGuards(RoleGuard)
    @Roles(UserRole.ADMIN)
    uploadPermitDocument(
        @Param('id') id: string,
        @Body('documentId') documentId: string,
    ) {
        return this.permitService.uploadPermitDocument(id, documentId);
    }

    @Get('booking/:bookingId')
    getPermitsByBooking(@Param('bookingId') bookingId: string) {
        return this.permitService.getPermitsByBooking(bookingId);
    }
}
