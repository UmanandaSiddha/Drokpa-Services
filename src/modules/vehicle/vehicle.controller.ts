import { Controller, Post, Get, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { VehicleService } from './vehicle.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { AuthGuard, getUser } from 'src/modules/auth/guards/auth.guard';
import { RoleGuard } from 'src/modules/auth/guards/role.guard';
import { Roles } from 'src/modules/auth/decorator/role.decorator';
import { UserRole } from 'generated/prisma/enums';

@Controller('vehicle')
export class VehicleController {
    constructor(private readonly vehicleService: VehicleService) { }

    @Post()
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.VENDOR)
    createVehicle(
        @Body() dto: CreateVehicleDto,
        @getUser('providerId') providerId: string,
    ) {
        return this.vehicleService.createVehicle(providerId, dto);
    }

    @Get()
    getVehicles(
        @Query('type') type?: string,
        @Query('isActive') isActive?: string,
        @Query('providerId') providerId?: string,
    ) {
        return this.vehicleService.getVehicles({
            type,
            isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
            providerId,
        });
    }

    @Get(':id')
    getVehicle(@Param('id') id: string) {
        return this.vehicleService.getVehicle(id);
    }

    @Put(':id')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.VENDOR)
    updateVehicle(
        @Param('id') id: string,
        @Body() dto: Partial<CreateVehicleDto>,
        @getUser('providerId') providerId: string,
    ) {
        return this.vehicleService.updateVehicle(id, providerId, dto);
    }

    @Delete(':id')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.VENDOR)
    deleteVehicle(
        @Param('id') id: string,
        @getUser('providerId') providerId: string,
    ) {
        return this.vehicleService.deleteVehicle(id, providerId);
    }

    @Get('provider/my-vehicles')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.VENDOR)
    getMyVehicles(@getUser('providerId') providerId: string) {
        return this.vehicleService.getMyVehicles(providerId);
    }
}
