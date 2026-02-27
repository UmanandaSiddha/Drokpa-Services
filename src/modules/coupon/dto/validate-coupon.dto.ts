import { IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

export class ValidateCouponDto {
    @IsString()
    code: string;

    /** The booking gross total (before discount) in rupees */
    @IsInt()
    @IsPositive()
    orderAmount: number;

    /** Number of participants — relevant for PER_PERSON coupons and minParticipants rules */
    @IsOptional()
    @IsInt()
    @IsPositive()
    participants?: number;
}
