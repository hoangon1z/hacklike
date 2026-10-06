import { DepositMethod } from '@prisma/client';
import { IsEnum, IsNumber, Max, Min } from 'class-validator';

export class CreateDepositDto {
  @IsEnum(DepositMethod) method!: DepositMethod;
  @IsNumber() @Min(10000) @Max(1000000000) amountVnd!: number;
}
