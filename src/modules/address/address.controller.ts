import { Controller, Post, Get, Put, Body, Param, Query } from '@nestjs/common';
import { AddressService } from './address.service';
import { CreateAddressDto } from './dto/create-address.dto';

@Controller('address')
export class AddressController {
    constructor(private readonly addressService: AddressService) { }

    @Post()
    createAddress(@Body() dto: CreateAddressDto) {
        return this.addressService.createAddress(dto);
    }

    @Get(':id')
    getAddress(@Param('id') id: string) {
        return this.addressService.getAddress(id);
    }

    @Put(':id')
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
        return this.addressService.getNearbyAddresses(
            parseFloat(latitude),
            parseFloat(longitude),
            radius ? parseFloat(radius) : 10,
        );
    }
}
