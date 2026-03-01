import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from 'src/services/database/database.service';
import { CreateOfflineBookingDto } from './dto/create-offline-booking.dto';
import { UpdateOfflineBookingDto } from './dto/update-offline-booking.dto';

@Injectable()
export class OfflineRoomBookingService {
    constructor(private readonly databaseService: DatabaseService) { }

    /**
     * Verifies the room exists and belongs to the given provider, or user is admin.
     */
    private async assertRoomOwnership(roomId: string, providerId: string, isAdmin = false) {
        const room = await this.databaseService.homestayRoom.findUnique({
            where: { id: roomId },
            include: { homestay: { select: { providerId: true } } },
        });
        if (!room) throw new NotFoundException('Room not found');
        if (!isAdmin && room.homestay.providerId !== providerId) {
            throw new ForbiddenException(
                'You do not have permission to manage this room',
            );
        }
        return room;
    }

    /**
     * Validates date range (checkIn < checkOut)
     */
    private validateDateRange(checkIn: Date, checkOut: Date) {
        if (checkIn >= checkOut) {
            throw new BadRequestException(
                'Check-out date must be after check-in date',
            );
        }
    }

    /**
     * Validates that offline booking doesn't exceed total rooms
     */
    private async validateRoomCapacity(
        roomId: string,
        roomsToBook: number,
        checkIn: Date,
        checkOut: Date,
        excludeBookingId?: string,
    ) {
        const room = await this.databaseService.homestayRoom.findUnique({
            where: { id: roomId },
        });

        if (!room) throw new NotFoundException('Room not found');

        // Get all overlapping offline bookings for this period
        const overlappingBookings =
            await this.databaseService.offlineRoomBooking.findMany({
                where: {
                    roomId,
                    ...(excludeBookingId && { id: { not: excludeBookingId } }),
                    checkIn: { lt: checkOut },
                    checkOut: { gt: checkIn },
                },
            });

        const totalBookedRooms = overlappingBookings.reduce(
            (sum, b) => sum + b.rooms,
            0,
        );

        if (totalBookedRooms + roomsToBook > room.totalRooms) {
            throw new BadRequestException(
                `Cannot book ${roomsToBook} rooms. Only ${room.totalRooms - totalBookedRooms} rooms available for this date range.`,
            );
        }
    }

    /**
     * Create an offline room booking
     */
    async createOfflineBooking(
        roomId: string,
        providerId: string,
        dto: CreateOfflineBookingDto,
        isAdmin = false,
    ) {
        await this.assertRoomOwnership(roomId, providerId, isAdmin);

        const checkIn = new Date(dto.checkIn);
        const checkOut = new Date(dto.checkOut);

        // Validate dates
        this.validateDateRange(checkIn, checkOut);

        // Validate room capacity
        await this.validateRoomCapacity(roomId, dto.rooms, checkIn, checkOut);

        // Create offline booking
        return this.databaseService.offlineRoomBooking.create({
            data: {
                roomId,
                guestName: dto.guestName,
                checkIn,
                checkOut,
                rooms: dto.rooms,
                noOfGuests: dto.noOfGuests,
                notes: dto.notes || null,
            },
            include: {
                room: {
                    select: {
                        id: true,
                        name: true,
                        homestay: { select: { id: true, name: true } },
                    },
                },
            },
        });
    }

    /**
     * Get all offline bookings for a room
     */
    async getOfflineBookingsForRoom(roomId: string, providerId: string, isAdmin = false) {
        await this.assertRoomOwnership(roomId, providerId, isAdmin);

        return this.databaseService.offlineRoomBooking.findMany({
            where: { roomId },
            orderBy: { checkIn: 'asc' },
            include: {
                room: {
                    select: {
                        id: true,
                        name: true,
                        totalRooms: true,
                    },
                },
            },
        });
    }

    /**
     * Get all offline bookings for a homestay
     */
    async getOfflineBookingsForHomestay(homestayId: string, providerId: string) {
        // Verify homestay ownership
        const homestay = await this.databaseService.homestay.findUnique({
            where: { id: homestayId },
        });

        if (!homestay) throw new NotFoundException('Homestay not found');
        if (homestay.providerId !== providerId) {
            throw new ForbiddenException(
                'You do not have permission to view this homestay',
            );
        }

        return this.databaseService.offlineRoomBooking.findMany({
            where: {
                room: { homestayId },
            },
            orderBy: { checkIn: 'asc' },
            include: {
                room: {
                    select: {
                        id: true,
                        name: true,
                        totalRooms: true,
                        homestay: { select: { id: true, name: true } },
                    },
                },
            },
        });
    }

    /**
     * Update an offline booking
     */
    async updateOfflineBooking(
        bookingId: string,
        roomId: string,
        providerId: string,
        dto: UpdateOfflineBookingDto,
        isAdmin = false,
    ) {
        await this.assertRoomOwnership(roomId, providerId, isAdmin);

        // Get existing booking
        const existingBooking =
            await this.databaseService.offlineRoomBooking.findUnique({
                where: { id: bookingId },
            });

        if (!existingBooking) throw new NotFoundException('Booking not found');
        if (existingBooking.roomId !== roomId) {
            throw new BadRequestException('Booking does not belong to this room');
        }

        const checkIn = dto.checkIn ? new Date(dto.checkIn) : existingBooking.checkIn;
        const checkOut = dto.checkOut ? new Date(dto.checkOut) : existingBooking.checkOut;
        const rooms = dto.rooms ?? existingBooking.rooms;
        const noOfGuests = dto.noOfGuests ?? existingBooking.noOfGuests;

        // Validate dates if changed
        if (dto.checkIn || dto.checkOut) {
            this.validateDateRange(checkIn, checkOut);
        }

        // Validate room capacity if rooms or dates changed
        if (dto.rooms || dto.checkIn || dto.checkOut) {
            await this.validateRoomCapacity(
                roomId,
                rooms,
                checkIn,
                checkOut,
                bookingId,
            );
        }

        // Update offline booking
        return this.databaseService.offlineRoomBooking.update({
            where: { id: bookingId },
            data: {
                guestName: dto.guestName ?? existingBooking.guestName,
                checkIn,
                checkOut,
                rooms,
                noOfGuests,
                notes: dto.notes !== undefined ? dto.notes : existingBooking.notes,
            },
            include: {
                room: {
                    select: {
                        id: true,
                        name: true,
                        homestay: { select: { id: true, name: true } },
                    },
                },
            },
        });
    }

    /**
     * Delete an offline booking
     */
    async deleteOfflineBooking(
        bookingId: string,
        roomId: string,
        providerId: string,
        isAdmin = false,
    ) {
        await this.assertRoomOwnership(roomId, providerId, isAdmin);

        // Get existing booking
        const existingBooking =
            await this.databaseService.offlineRoomBooking.findUnique({
                where: { id: bookingId },
            });

        if (!existingBooking) throw new NotFoundException('Booking not found');
        if (existingBooking.roomId !== roomId) {
            throw new BadRequestException('Booking does not belong to this room');
        }

        // Delete offline booking
        return this.databaseService.offlineRoomBooking.delete({
            where: { id: bookingId },
        });
    }
}
