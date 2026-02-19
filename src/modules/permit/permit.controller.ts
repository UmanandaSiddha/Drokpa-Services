// permit.controller.ts
import {
    Controller, Post, Get, Patch,
    Body, Param, UseGuards,
} from '@nestjs/common';
import { PermitService } from './permit.service';
import { SubmitPermitDto } from './dto/submit-permit.dto';
import { ApprovePermitDto } from './dto/approve-permit.dto';
import { RejectPermitDto } from './dto/reject-permit.dto';
import { UploadPermitDocumentDto } from './dto/upload-document.dto';
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
        @getUser('id') userId: string,
    ) {
        return this.permitService.submitPermit(id, userId, dto);
    }

    // Static routes above :id

    @Get('booking/:bookingId')
    getPermitsByBooking(
        @Param('bookingId') bookingId: string,
        @getUser('id') userId: string,
    ) {
        return this.permitService.getPermitsByBooking(bookingId, userId);
    }

    @Get(':id')
    getPermit(
        @Param('id') id: string,
        @getUser('id') userId: string,
    ) {
        return this.permitService.getPermit(id, userId);
    }

    // Admin actions

    @Patch(':id/approve')
    @UseGuards(RoleGuard)
    @Roles(UserRole.ADMIN)
    approvePermit(
        @Param('id') id: string,
        @Body() dto: ApprovePermitDto,
    ) {
        return this.permitService.approvePermit(id, dto.permitDocumentId);
    }

    @Patch(':id/reject')
    @UseGuards(RoleGuard)
    @Roles(UserRole.ADMIN)
    rejectPermit(
        @Param('id') id: string,
        @Body() dto: RejectPermitDto,
    ) {
        return this.permitService.rejectPermit(id, dto.reason);
    }

    @Post(':id/document')
    @UseGuards(RoleGuard)
    @Roles(UserRole.ADMIN)
    uploadPermitDocument(
        @Param('id') id: string,
        @Body() dto: UploadPermitDocumentDto,
    ) {
        return this.permitService.uploadPermitDocument(id, dto.documentId);
    }
}