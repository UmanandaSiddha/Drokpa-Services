import { IsOptional, IsUUID } from 'class-validator';

export class ApprovePermitDto {
    @IsOptional()
    @IsUUID()
    permitDocumentId?: string;
}