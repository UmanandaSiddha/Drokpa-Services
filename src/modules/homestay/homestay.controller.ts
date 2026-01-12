import { Controller, Post, Get, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { HomestayService } from './homestay.service';
import { CreateHomestayDto } from './dto/create-homestay.dto';
import { AuthGuard, getUser } from 'src/modules/auth/guards/auth.guard';
import { RoleGuard } from 'src/modules/auth/guards/role.guard';
import { Roles } from 'src/modules/auth/decorator/role.decorator';
import { UserRole } from 'generated/prisma/enums';

@Controller('homestay')
export class HomestayController {
    constructor(private readonly homestayService: HomestayService) { }

    @Post()
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.HOST)
    createHomestay(
        @Body() dto: CreateHomestayDto,
        @getUser('providerId') providerId: string,
    ) {
        return this.homestayService.createHomestay(providerId, dto);
    }

    @Get()
    getHomestays(
        @Query('isActive') isActive?: string,
        @Query('providerId') providerId?: string,
    ) {
        return this.homestayService.getHomestays({
            isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
            providerId,
        });
    }

    @Get(':id')
    getHomestay(@Param('id') id: string) {
        return this.homestayService.getHomestay(id);
    }

    @Put(':id')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.HOST)
    updateHomestay(
        @Param('id') id: string,
        @Body() dto: Partial<CreateHomestayDto>,
        @getUser('providerId') providerId: string,
    ) {
        return this.homestayService.updateHomestay(id, providerId, dto);
    }

    @Get('provider/my-homestays')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.HOST)
    getProviderHomestays(@getUser('providerId') providerId: string) {
        return this.homestayService.getProviderHomestays(providerId);
    }
}
