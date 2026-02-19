import { IsUUID } from 'class-validator';

export class UploadPermitDocumentDto {
    @IsUUID()
    documentId: string;
}