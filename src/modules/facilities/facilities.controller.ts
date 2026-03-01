import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
} from '@nestjs/common';
import { AuthGuard } from 'src/modules/auth/guards/auth.guard';
import { RoleGuard } from 'src/modules/auth/guards/role.guard';
import { Roles } from 'src/modules/auth/decorator/role.decorator';
import { UserRole } from 'generated/prisma/enums';
import { QueryString } from 'src/utils/apiFeatures';
import { FacilitiesService } from './facilities.service';

@Controller('facilities')
export class FacilitiesController {
    constructor(private readonly facilitiesService: FacilitiesService) { }

    // ─────────────────────────────────────────
    // GET all facilities (public)
    // ─────────────────────────────────────────
    @Get()
    getAllFacilities(@Query() query: QueryString) {
        return this.facilitiesService.getAllFacilities(query);
    }

    // ─────────────────────────────────────────
    // GET facility by ID (public)
    // ─────────────────────────────────────────
    @Get(':id')
    getFacilityById(@Param('id') id: string) {
        return this.facilitiesService.getFacilityById(id);
    }

    // ─────────────────────────────────────────
    // CREATE facility (admin/host only)
    // ─────────────────────────────────────────
    @Post()
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN, UserRole.HOST)
    createFacility(@Body() data: { name: string; icon: string; description?: string; category?: string }) {
        return this.facilitiesService.createFacility(data);
    }

    // ─────────────────────────────────────────
    // UPDATE facility (admin/host only)
    // ─────────────────────────────────────────
    @Patch(':id')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN, UserRole.HOST)
    updateFacility(
        @Param('id') id: string,
        @Body() data: { name?: string; icon?: string; description?: string; category?: string }
    ) {
        return this.facilitiesService.updateFacility(id, data);
    }

    // ─────────────────────────────────────────
    // DELETE facility (admin/host only)
    // ─────────────────────────────────────────
    @Delete(':id')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN, UserRole.HOST)
    deleteFacility(@Param('id') id: string) {
        return this.facilitiesService.deleteFacility(id);
    }
}
