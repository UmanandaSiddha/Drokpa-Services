import { IsNotEmpty, IsString } from "class-validator";

export class DeleteObjectDto {
    @IsString()
    @IsNotEmpty()
    key: string;
}