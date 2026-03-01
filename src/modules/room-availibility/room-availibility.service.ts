import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from 'src/services/database/database.service';
import { Prisma } from 'generated/prisma/client';
import { SetAvailabilityDto } from './dto/set-availability.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';

@Injectable()
export class RoomAvailabilityService {
    constructor(private readonly databaseService: DatabaseService) { }

    // ─────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────

    /**
     * Verifies the room exists and belongs to the given provider.
     * Separates existence (404) from ownership (403).
     */
    private async assertRoomOwnership(roomId: string, providerId: string) {
        const room = await this.databaseService.homestayRoom.findUnique({
            where: { id: roomId },
            include: { homestay: { select: { providerId: true } } },
        });
        if (!room) throw new NotFoundException('Room not found');
        if (room.homestay.providerId !== providerId) {
            throw new ForbiddenException('You do not have permission to manage this room');
        }
        return room;
    }

    /**
     * Generates an array of Date objects for each day in [startDate, endDate).
     * End date is exclusive — a booking from Jan 1–3 occupies Jan 1 and Jan 2.
     */
    private generateDateRange(startDate: Date, endDate: Date): Date[] {
        const dates: Date[] = [];
        const current = new Date(startDate);
        current.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(0, 0, 0, 0);

        while (current < end) {
            dates.push(new Date(current));
            current.setDate(current.getDate() + 1);
        }
        return dates;
    }

    // ─────────────────────────────────────────
    // Set availability (Provider)
    // Creates or overwrites availability for a date range
    // ─────────────────────────────────────────

    async setAvailability(
        roomId: string,
        providerId: string,
        dto: SetAvailabilityDto,
        skipOwnershipCheck = false,
    ) {
        if (!skipOwnershipCheck) await this.assertRoomOwnership(roomId, providerId);

        const startDate = new Date(dto.startDate);
        const endDate = new Date(dto.endDate);

        if (startDate >= endDate) {
            throw new BadRequestException('startDate must be before endDate');
        }
        if (startDate < new Date(new Date().setHours(0, 0, 0, 0))) {
            throw new BadRequestException('Cannot set availability for past dates');
        }

        const dates = this.generateDateRange(startDate, endDate);

        // Upsert each date — provider can call this multiple times to adjust counts
        await this.databaseService.$transaction(
            dates.map(date =>
                this.databaseService.roomAvailability.upsert({
                    where: { roomId_date: { roomId, date } },
                    create: {
                        roomId,
                        date,
                        available: dto.available,
                        // price: dto.price,
                    },
                    update: {
                        available: dto.available,
                        // ...(dto.price !== undefined && { price: dto.price }),
                    },
                }),
            ),
        );

        return {
            message: `Availability set for ${dates.length} date(s)`,
            roomId,
            startDate: dto.startDate,
            endDate: dto.endDate,
            available: dto.available,
        };
    }

    // ─────────────────────────────────────────
    // Update single date (Provider)
    // Fine-grained control over a specific date
    // ─────────────────────────────────────────

    async updateSingleDate(
        roomId: string,
        providerId: string,
        dto: UpdateAvailabilityDto,
        skipOwnershipCheck = false,
    ) {
        if (!skipOwnershipCheck) await this.assertRoomOwnership(roomId, providerId);

        const date = new Date(dto.date);
        date.setHours(0, 0, 0, 0);

        if (date < new Date(new Date().setHours(0, 0, 0, 0))) {
            throw new BadRequestException('Cannot update availability for past dates');
        }

        const existing = await this.databaseService.roomAvailability.findUnique({
            where: { roomId_date: { roomId, date } },
        });

        if (!existing) {
            throw new NotFoundException(
                `No availability record found for ${dto.date}. Use the set endpoint to create one.`,
            );
        }

        const data: Prisma.RoomAvailabilityUpdateInput = {
            ...(dto.available !== undefined && { available: dto.available }),
            ...(dto.price !== undefined && { price: dto.price }),
        };

        return this.databaseService.roomAvailability.update({
            where: { roomId_date: { roomId, date } },
            data,
        });
    }

    // ─────────────────────────────────────────
    // Get availability for a room (Public)
    // Used by booking flow and frontend calendar
    // ─────────────────────────────────────────

    async getRoomAvailability(roomId: string, startDate: string, endDate: string) {
        const room = await this.databaseService.homestayRoom.findUnique({
            where: { id: roomId },
            select: { id: true },
        });
        if (!room) throw new NotFoundException('Room not found');

        const start = new Date(startDate);
        const end = new Date(endDate);

        if (start >= end) {
            throw new BadRequestException('startDate must be before endDate');
        }

        const records = await this.databaseService.roomAvailability.findMany({
            where: {
                roomId,
                date: { gte: start, lt: end },
            },
            orderBy: { date: 'asc' },
        });

        return {
            roomId,
            startDate,
            endDate,
            availability: records,
        };
    }

    // ─────────────────────────────────────────
    // Block dates (Provider)
    // Sets available = 0 for a range (e.g. maintenance, hold)
    // ─────────────────────────────────────────

    async blockDates(
        roomId: string,
        providerId: string,
        dto: Omit<SetAvailabilityDto, 'available'>,
        skipOwnershipCheck = false,
    ) {
        return this.setAvailability(roomId, providerId, {
            ...dto,
            available: 0,
        }, skipOwnershipCheck);
    }

    // ─────────────────────────────────────────
    // Delete availability range (Provider)
    // Removes records entirely — different from blocking (sets to 0)
    // ─────────────────────────────────────────

    async deleteAvailabilityRange(
        roomId: string,
        providerId: string,
        startDate: string,
        endDate: string,
        skipOwnershipCheck = false,
    ) {
        if (!skipOwnershipCheck) await this.assertRoomOwnership(roomId, providerId);

        const start = new Date(startDate);
        const end = new Date(endDate);

        if (start >= end) {
            throw new BadRequestException('startDate must be before endDate');
        }

        const { count } = await this.databaseService.roomAvailability.deleteMany({
            where: {
                roomId,
                date: { gte: start, lt: end },
                // Only delete dates with no active bookings decrement
                // (available === original count means no bookings on that date)
                // Deletion is safe — booking flow checks available > 0
            },
        });

        return { message: `Deleted ${count} availability record(s)`, roomId };
    }

    // ─────────────────────────────────────────
    // Get my rooms availability summary (Provider)
    // Overview of all rooms in a homestay for a date range
    // ─────────────────────────────────────────

    async getHomestayAvailabilitySummary(
        homestayId: string,
        providerId: string,
        startDate: string,
        endDate: string,
        skipOwnershipCheck = false,
    ) {
        const homestay = await this.databaseService.homestay.findUnique({
            where: { id: homestayId },
            select: { id: true, providerId: true, rooms: { select: { id: true, name: true } } },
        });
        if (!homestay) throw new NotFoundException('Homestay not found');
        if (!skipOwnershipCheck && homestay.providerId !== providerId) {
            throw new ForbiddenException('You do not have permission to view this homestay');
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        if (start >= end) {
            throw new BadRequestException('startDate must be before endDate');
        }

        const roomIds = homestay.rooms.map(r => r.id);

        const availability = await this.databaseService.roomAvailability.findMany({
            where: {
                roomId: { in: roomIds },
                date: { gte: start, lt: end },
            },
            orderBy: [{ roomId: 'asc' }, { date: 'asc' }],
        });

        // Group by room for easier frontend consumption
        const grouped = homestay.rooms.map(room => ({
            room: { id: room.id, name: room.name },
            availability: availability.filter(a => a.roomId === room.id),
        }));

        return { homestayId, startDate, endDate, rooms: grouped };
    }
}