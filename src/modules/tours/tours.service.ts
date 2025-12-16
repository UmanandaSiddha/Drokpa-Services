import { Injectable } from "@nestjs/common";
import { DatabaseService } from "src/services/database/database.service";
import { CreateTourDto } from "./dto/create-tour.dto";
import { AddItineraryDto } from "./dto/add-itinerary.dto";

@Injectable()
export class ToursService {
    constructor(private readonly databaseService: DatabaseService) { }

    async create(providerId: string, dto: CreateTourDto) {
        return this.databaseService.tour.create({
            data: {
                ...dto,
                providerId,
            },
        });
    }

    async findAll() {
        return this.databaseService.tour.findMany({
            where: { isActive: true },
            include: { itinerary: true },
        });
    }

    async findOne(id: string) {
        return this.databaseService.tour.findUnique({
            where: { id },
            include: { itinerary: true },
        });
    }

    async update(id: string, dto: Partial<CreateTourDto>) {
        return this.databaseService.tour.update({
            where: { id },
            data: dto,
        });
    }

    async remove(id: string) {
        return this.databaseService.tour.update({
            where: { id },
            data: { isActive: false },
        });
    }

    async addItinerary(tourId: string, dto: AddItineraryDto) {
        return this.databaseService.tourItinerary.create({
            data: {
                tourId,
                ...dto,
            },
        });
    }
}