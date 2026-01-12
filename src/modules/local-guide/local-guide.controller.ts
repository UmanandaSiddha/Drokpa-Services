import { Controller, Post, Get, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { LocalGuideService } from './local-guide.service';
import { CreateLocalGuideDto } from './dto/create-local-guide.dto';
import { AuthGuard, getUser } from 'src/modules/auth/guards/auth.guard';
import { RoleGuard } from 'src/modules/auth/guards/role.guard';
import { Roles } from 'src/modules/auth/decorator/role.decorator';
import { UserRole } from 'generated/prisma/enums';

@Controller('local-guide')
export class LocalGuideController {
    constructor(private readonly localGuideService: LocalGuideService) { }

    @Post()
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.GUIDE)
    createGuide(
        @Body() dto: CreateLocalGuideDto,
        @getUser('providerId') providerId: string,
    ) {
        return this.localGuideService.createGuide(providerId, dto);
    }

    @Get()
    getGuides(
        @Query('isActive') isActive?: string,
        @Query('providerId') providerId?: string,
        @Query('specialties') specialties?: string,
    ) {
        return this.localGuideService.getGuides({
            isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
            providerId,
            specialties: specialties ? specialties.split(',') : undefined,
        });
    }

    @Get(':id')
    getGuide(@Param('id') id: string) {
        return this.localGuideService.getGuide(id);
    }

    @Put(':id')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.GUIDE)
    updateGuide(
        @Param('id') id: string,
        @Body() dto: Partial<CreateLocalGuideDto>,
        @getUser('providerId') providerId: string,
    ) {
        return this.localGuideService.updateGuide(id, providerId, dto);
    }

    @Delete(':id')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.GUIDE)
    deleteGuide(
        @Param('id') id: string,
        @getUser('providerId') providerId: string,
    ) {
        return this.localGuideService.deleteGuide(id, providerId);
    }

    @Get('provider/my-guides')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.GUIDE)
    getMyGuides(@getUser('providerId') providerId: string) {
        return this.localGuideService.getMyGuides(providerId);
    }
}
