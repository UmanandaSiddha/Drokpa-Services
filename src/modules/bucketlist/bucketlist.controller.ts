import { Controller, Post, Get, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { BucketListService } from './bucketlist.service';
import { CreateBucketListDto } from './dto/create-bucketlist.dto';
import { AddBucketListItemDto } from './dto/add-item.dto';
import { AuthGuard, getUser } from 'src/modules/auth/guards/auth.guard';
import { BucketListStatus } from 'generated/prisma/enums';

@Controller('bucketlist')
@UseGuards(AuthGuard)
export class BucketListController {
    constructor(private readonly bucketListService: BucketListService) { }

    @Post()
    createBucketList(
        @Body() dto: CreateBucketListDto,
        @getUser('id') userId: string,
    ) {
        return this.bucketListService.createBucketList(userId, dto);
    }

    @Post(':id/item')
    addItem(
        @Param('id') id: string,
        @Body() dto: AddBucketListItemDto,
        @getUser('id') userId: string,
    ) {
        return this.bucketListService.addItem(id, userId, dto);
    }

    @Put(':id/item/:itemId')
    updateItem(
        @Param('id') id: string,
        @Param('itemId') itemId: string,
        @Body() dto: Partial<AddBucketListItemDto>,
        @getUser('id') userId: string,
    ) {
        return this.bucketListService.updateItem(id, itemId, userId, dto);
    }

    @Delete(':id/item/:itemId')
    removeItem(
        @Param('id') id: string,
        @Param('itemId') itemId: string,
        @getUser('id') userId: string,
    ) {
        return this.bucketListService.removeItem(id, itemId, userId);
    }

    @Get()
    getBucketLists(
        @getUser('id') userId: string,
        @Query('status') status?: BucketListStatus,
    ) {
        return this.bucketListService.getBucketLists(userId, status);
    }

    @Get(':id')
    getBucketList(
        @Param('id') id: string,
        @getUser('id') userId: string,
    ) {
        return this.bucketListService.getBucketList(id, userId);
    }

    @Post(':id/checkout')
    checkout(
        @Param('id') id: string,
        @getUser('id') userId: string,
    ) {
        return this.bucketListService.checkout(id, userId);
    }

    @Delete(':id')
    deleteBucketList(
        @Param('id') id: string,
        @getUser('id') userId: string,
    ) {
        return this.bucketListService.deleteBucketList(id, userId);
    }
}
