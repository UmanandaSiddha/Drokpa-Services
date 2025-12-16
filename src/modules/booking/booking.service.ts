import { BadRequestException, Injectable } from "@nestjs/common";
import { DatabaseService } from "src/services/database/database.service";
import { RazorpayService } from "src/services/razorpay/razorpay.service";
import { CreateTourBookingDto } from "./dto/create-tour-booking.dto";
import { CreateHomestayBookingDto } from "./dto/create-homestay-booking.dto";

@Injectable()
export class BookingService {

    constructor(
        private readonly databaseService: DatabaseService,
        private readonly razorpayService: RazorpayService
    ) { }

    async createTourBooking(
        userId: string,
        payload: CreateTourBookingDto
    ) {
        const tour = await this.databaseService.tour.findUnique({
            where: { id: payload.tourId },
        });

        if (!tour || !tour.isActive) {
            throw new BadRequestException('Tour not available');
        }

        if (tour.maxCapacity && payload.guests.length > tour.maxCapacity) {
            throw new BadRequestException('Capacity exceeded');
        }

        return this.databaseService.$transaction(async tx => {
            const booking = await tx.booking.create({
                data: {
                    userId,
                    status: 'CREATED',
                },
            });

            const item = await tx.bookingItem.create({
                data: {
                    bookingId: booking.id,
                    productType: 'TOUR',
                    productId: tour.id,
                    startDate: payload.startDate,
                    quantity: payload.guests.length,
                    price: tour.price * payload.guests.length,
                },
            });

            for (const guest of payload.guests) {
                await tx.bookingGuest.create({
                    data: {
                        bookingItemId: item.id,
                        ...guest,
                    },
                });
            }

            return booking;
        });
    }

    async createPaymentForBooking(bookingId: string) {
        const booking = await this.databaseService.booking.findUnique({
            where: { id: bookingId },
            include: { items: true },
        });

        const amount = booking.items.reduce((sum, i) => sum + i.price, 0);

        const order = await this.razorpayService.createOrder({
            amount: amount * 100,
            receipt: bookingId,
        });

        return this.databaseService.payment.create({
            data: {
                bookingId,
                amount,
                provider: 'RAZORPAY',
                status: 'CREATED',
                providerOrderId: order.id,
            },
        });
    }

    async createHomestayBooking(
        userId: string,
        dto: CreateHomestayBookingDto,
    ) {
        const checkIn = new Date(dto.checkIn);
        const checkOut = new Date(dto.checkOut);

        return this.databaseService.$transaction(async tx => {
            // 1️⃣ Lock availability rows
            const availability = await tx.roomAvailability.findMany({
                where: {
                    roomId: dto.roomId,
                    date: {
                        gte: checkIn,
                        lt: checkOut,
                    },
                },
                //lock: { mode: 'ForUpdate' }, // 👈 VERY IMPORTANT
            });

            if (availability.length === 0) {
                throw new BadRequestException('Room not available');
            }

            if (availability.some(a => a.available < dto.rooms)) {
                throw new BadRequestException('Not enough rooms available');
            }

            // 2️⃣ Reduce availability
            await Promise.all(
                availability.map(a =>
                    tx.roomAvailability.update({
                        where: { id: a.id },
                        data: { available: { decrement: dto.rooms } },
                    }),
                ),
            );

            // 3️⃣ Create booking
            const booking = await tx.booking.create({
                data: {
                    userId,
                    status: 'CREATED',
                },
            });

            const room = await tx.homestayRoom.findUnique({
                where: { id: dto.roomId },
            });

            const nights =
                (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24);

            const item = await tx.bookingItem.create({
                data: {
                    bookingId: booking.id,
                    productType: 'HOMESTAY_ROOM',
                    productId: dto.roomId,
                    startDate: checkIn,
                    endDate: checkOut,
                    quantity: dto.rooms,
                    price: room.basePrice * nights * dto.rooms,
                },
            });

            for (const guest of dto.guests) {
                await tx.bookingGuest.create({
                    data: {
                        bookingItemId: item.id,
                        ...guest,
                    },
                });
            }

            return booking;
        });
    }


}