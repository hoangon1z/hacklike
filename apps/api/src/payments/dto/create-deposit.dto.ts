import { DepositMethod } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateDepositDto {
  @IsEnum(DepositMethod) method!: DepositMethod;
  @IsNumber() @Min(10000) @Max(1000000000) amountVnd!: number;
  @IsOptional() @IsString() @MaxLength(64) bankAccountId?: string;
}
