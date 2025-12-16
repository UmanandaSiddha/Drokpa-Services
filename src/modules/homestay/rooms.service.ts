import { Injectable } from "@nestjs/common";
import { DatabaseService } from "src/services/database/database.service";
import { CreateHomestayRoomDto } from "./dto/create-room.dto";

@Injectable()
export class HomestayRoomsService {
    constructor(
        private readonly databaseService: DatabaseService
    ) { }

    async createRoom(
        homestayId: string,
        dto: CreateHomestayRoomDto,
    ) {
        const room = await this.databaseService.homestayRoom.create({
            data: {
                ...dto,
                homestayId,
            },
        });

        return room;
    }

    async generateAvailability(
        roomId: string,
        start: Date,
        end: Date,
    ) {
        const days: Date[] = [];
        for (
            let d = new Date(start);
            d <= end;
            d.setDate(d.getDate() + 1)
        ) {
            days.push(new Date(d));
        }

        const room = await this.databaseService.homestayRoom.findUnique({
            where: { id: roomId },
        });

        await this.databaseService.roomAvailability.createMany({
            data: days.map(date => ({
                roomId,
                date,
                available: room.totalRooms,
            })),
            skipDuplicates: true,
        });
    }
}
