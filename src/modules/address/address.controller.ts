import { Controller, Post, Get, Put, Body, Param, Query, BadRequestException } from '@nestjs/common';
import { AddressService } from './address.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { QueryString } from 'src/utils/apiFeatures';

@Controller('addresses')
export class AddressController {
    constructor(private readonly addressService: AddressService) { }

    @Get()
    getAllAddresses(@Query() query: QueryString) {
        return this.addressService.getAllAddresses(query);
    }

    @Post()
    createAddress(@Body() dto: CreateAddressDto) {
        return this.addressService.createAddress(dto);
    }

    @Get('byId/:id')
    getAddress(@Param('id') id: string) {
        return this.addressService.getAddress(id);
    }

    @Put('byId/:id')
    updateAddress(
        @Param('id') id: string,
        @Body() dto: Partial<CreateAddressDto>,
    ) {
        return this.addressService.updateAddress(id, dto);
    }

    @Get('nearby')
    getNearbyAddresses(
        @Query('latitude') latitude: string,
        @Query('longitude') longitude: string,
        @Query('radius') radius?: string,
    ) {
        const lat = parseFloat(latitude);
        const lon = parseFloat(longitude);
        if (isNaN(lat) || isNaN(lon)) {
            throw new BadRequestException('Valid latitude and longitude are required');
        }
        return this.addressService.getNearbyAddresses(lat, lon, radius ? parseFloat(radius) : 10);
    }
}
