import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

export class AssignCouponDto {
    /** IDs of users to assign the coupon to */
    @IsArray()
    @IsUUID('4', { each: true })
    userIds: string[];

    @IsOptional()
    @IsString()
    note?: string;
}
