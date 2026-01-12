import { IsString, IsOptional } from 'class-validator';

export class CreateBucketListDto {
    @IsString()
    @IsOptional()
    tripName?: string;
}
