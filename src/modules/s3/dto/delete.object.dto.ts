import { IsNotEmpty, IsString, Matches } from "class-validator";

export class DeleteObjectDto {
    @IsString()
    @IsNotEmpty()
    @Matches(/^[a-zA-Z0-9\-_\/\.]+$/, { message: 'Invalid key format' })
    key: string;
}