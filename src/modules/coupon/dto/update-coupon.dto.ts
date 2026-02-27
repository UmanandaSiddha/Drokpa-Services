import { PartialType } from '@nestjs/mapped-types';
import { CreateCouponDto } from './create-coupon.dto';

/**
 * UpdateCouponDto — all fields optional (partial of CreateCouponDto).
 * The service layer casts to `any` before passing to Prisma to avoid
 * false-positive TypeScript errors from PartialType inference.
 */
export class UpdateCouponDto extends PartialType(CreateCouponDto) { }
