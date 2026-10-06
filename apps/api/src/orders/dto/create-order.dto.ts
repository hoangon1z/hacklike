import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  MaxLength,
} from "class-validator";
export class CreateOrderDto {
  @IsString() serviceId!: string;
  @IsUrl({ require_protocol: true }) link!: string;
  @IsInt() @Min(1) quantity!: number;
  @IsOptional() @IsString() @MaxLength(100000) comments?: string;
  @IsOptional() @IsISO8601() scheduledAt?: string;
}
