import { IsString, IsNotEmpty } from 'class-validator';

export class DigiLockerCallbackDto {
    @IsString()
    @IsNotEmpty()
    code: string;

    @IsString()
    @IsNotEmpty()
    state: string;
}
