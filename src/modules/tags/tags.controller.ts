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
import { TagsService } from './tags.service';

@Controller('tags')
export class TagsController {
    constructor(private readonly tagsService: TagsService) { }

    // ─────────────────────────────────────────
    // GET all tags (public)
    // ─────────────────────────────────────────
    @Get()
    getAllTags(@Query() query: QueryString) {
        return this.tagsService.getAllTags(query);
    }

    // ─────────────────────────────────────────
    // GET tag by ID (public)
    // ─────────────────────────────────────────
    @Get(':id')
    getTagById(@Param('id') id: string) {
        return this.tagsService.getTagById(id);
    }

    // ─────────────────────────────────────────
    // CREATE tag (admin only)
    // ─────────────────────────────────────────
    @Post()
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    createTag(@Body() data: { label: string; color: string; icon?: string; category?: string }) {
        return this.tagsService.createTag(data);
    }

    // ─────────────────────────────────────────
    // UPDATE tag (admin only)
    // ─────────────────────────────────────────
    @Patch(':id')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    updateTag(
        @Param('id') id: string,
        @Body() data: { label?: string; color?: string; icon?: string; category?: string }
    ) {
        return this.tagsService.updateTag(id, data);
    }

    // ─────────────────────────────────────────
    // DELETE tag (admin only)
    // ─────────────────────────────────────────
    @Delete(':id')
    @UseGuards(AuthGuard, RoleGuard)
    @Roles(UserRole.ADMIN)
    deleteTag(@Param('id') id: string) {
        return this.tagsService.deleteTag(id);
    }
}
