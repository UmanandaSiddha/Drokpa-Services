import {
    IsEmail,
    IsNotEmpty,
} from 'class-validator';

export class RequestDto {
    @IsNotEmpty()
    @IsEmail()
    email: string;
}
