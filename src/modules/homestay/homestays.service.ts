import { Injectable } from "@nestjs/common";
import { DatabaseService } from "src/services/database/database.service";
import { CreateHomestayDto } from "./dto/create-homestay.dto";

@Injectable()
export class HomestayService {
    constructor(
        private readonly databaseService: DatabaseService
    ) { }

    async createHomestay(providerId: string, dto: CreateHomestayDto) {
        return this.databaseService.homestay.create({
            data: {
                ...dto,
                providerId,
            },
        });
    }

    async getProviderHomestays(providerId: string) {
        return this.databaseService.homestay.findMany({
            where: { providerId },
            include: { rooms: true },
        });
    }
}