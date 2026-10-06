import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ServicePricingMode } from '@prisma/client';
export class UpdateServiceDto {
  @IsOptional() @IsBoolean() adminEnabled?: boolean;
  @IsOptional() @IsEnum(ServicePricingMode) pricingMode?: ServicePricingMode;
  @IsOptional() @IsNumber() @Min(0) markupValue?: number;
  @IsOptional() @IsNumber() @Min(0) minimumSafeMargin?: number;
}
export class BulkServiceStatusDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @IsString({each:true}) ids!:string[];
  @IsBoolean() enabled!:boolean;
}
export class BulkServicePricingDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(1000) @IsString({each:true}) ids!:string[];
  @IsEnum(ServicePricingMode) pricingMode!:ServicePricingMode;
  @IsNumber() @Min(0) markupValue!:number;
  @IsNumber() @Min(0) minimumSafeMargin!:number;
}
