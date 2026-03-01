import {
    Controller, Post, Get, Patch, Delete,
    Body, Param, Query, UseGuards,
    BadRequestException, ParseEnumPipe,
} from '@nestjs/common';
import { VehicleService } from './vehicle.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { AuthGuard, getUser } from 'src/modules/auth/guards/auth.guard';
import { RoleGuard } from 'src/modules/auth/guards/role.guard';
import { Roles } from 'src/modules/auth/decorator/role.decorator';
import { UserRole, VehicleType } from 'generated/prisma/enums';
import { QueryString } from 'src/utils/apiFeatures';

@Controller('vehicle')
export class VehicleController {
    constructor(private readonly vehicleService: VehicleService) { }

    @Post()
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.VENDOR, UserRole.ADMIN)
    async createVehicle(
        @Body() dto: CreateVehicleDto,
        @getUser('providerId') providerId: string,
        @getUser('roles') userRoles: { role: UserRole }[],
        @Query('onBehalfOf') onBehalfOf?: string,
    ) {
        const isAdmin = userRoles.some(r => r.role === UserRole.ADMIN);
        if (isAdmin && !onBehalfOf) {
            throw new BadRequestException('Admin must supply ?onBehalfOf=<providerId> to create a vehicle on behalf of a provider');
        }
        // Admin supplies the target provider's providerId directly via onBehalfOf
        const effectiveProviderId = isAdmin ? onBehalfOf! : providerId;
        return this.vehicleService.createVehicle(effectiveProviderId, dto);
    }

    // Static routes above :id

    @Get('nearby')
    getNearbyVehicles(
        @Query('latitude') latitude?: string,
        @Query('longitude') longitude?: string,
        @Query('radius') radius?: string,
    ) {
        if (!latitude || !longitude) {
            throw new BadRequestException('latitude and longitude are required');
        }
        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);
        if (isNaN(lat) || isNaN(lng)) {
            throw new BadRequestException('latitude and longitude must be valid numbers');
        }
        return this.vehicleService.getNearbyVehicles(lat, lng, radius ? parseFloat(radius) : 20);
    }

    @Get('provider/my-vehicles')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.VENDOR, UserRole.ADMIN)
    getMyVehicles(
        @getUser('providerId') providerId: string,
        @getUser('roles') userRoles: { role: UserRole }[],
        @Query('onBehalfOf') onBehalfOf?: string,
    ) {
        const isAdmin = userRoles.some(r => r.role === UserRole.ADMIN);
        // Admin can supply ?onBehalfOf to view vehicles for any provider
        const effectiveProviderId = isAdmin && onBehalfOf ? onBehalfOf : providerId;
        return this.vehicleService.getMyVehicles(effectiveProviderId);
    }

    @Get()
    getVehicles(
        @Query() query: QueryString,
        @Query('type', new ParseEnumPipe(VehicleType, { optional: true }))
        type?: VehicleType,
        @Query('isActive') isActive?: string,
    ) {
        return this.vehicleService.getVehicles(query, {
            type,
            isActive:
                isActive === 'true' ? true
                    : isActive === 'false' ? false
                        : undefined,
        });
    }

    @Get(':id')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.VENDOR, UserRole.ADMIN)
    getVehicle(
        @Param('id') id: string,
        @getUser('providerId') providerId: string,
        @getUser('roles') userRoles: { role: UserRole }[],
        @Query('onBehalfOf') onBehalfOf?: string,
    ) {
        const isAdmin = userRoles.some(r => r.role === UserRole.ADMIN);
        // Admin can supply ?onBehalfOf to view vehicle for any provider
        const effectiveProviderId = isAdmin && onBehalfOf ? onBehalfOf : providerId;
        // For admin: pass effectiveProviderId and isAdmin flag. For vendor: pass providerId and isAdmin false.
        return this.vehicleService.getVehicle(id);
    }

    @Patch(':id')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.VENDOR, UserRole.ADMIN)
    updateVehicle(
        @Param('id') id: string,
        @Body() dto: Partial<CreateVehicleDto>,
        @getUser('providerId') providerId: string,
        @getUser('roles') userRoles: { role: UserRole }[],
    ) {
        const isAdmin = userRoles.some(r => r.role === UserRole.ADMIN);
        return this.vehicleService.updateVehicle(id, providerId, dto, isAdmin);
    }

    @Delete(':id')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.VENDOR, UserRole.ADMIN)
    deleteVehicle(
        @Param('id') id: string,
        @getUser('providerId') providerId: string,
        @getUser('roles') userRoles: { role: UserRole }[],
    ) {
        const isAdmin = userRoles.some(r => r.role === UserRole.ADMIN);
        return this.vehicleService.deleteVehicle(id, providerId, isAdmin);
    }
}