import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { CreateOrderDto } from "./dto/create-order.dto";
import { OrdersService } from "./orders.service";
import { CurrentUser } from "../auth/current-user.decorator";
import { AuthUser } from "../auth/auth.types";
@Controller("orders")
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}
  @Post() async create(
    @Body() dto: CreateOrderDto,
    @Headers("idempotency-key") key: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return {
      success: true,
      data: await this.orders.create(user.sub, key ?? "", dto),
    };
  }
  @Get() async list(@CurrentUser() user: AuthUser, @Query("group") group?: string) {
    return { success: true, data: await this.orders.list(user.sub, group) };
  }
  @Get(":id") async get(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return { success: true, data: await this.orders.get(user.sub, id) };
  }
  @Patch(":id/cancel-schedule") async cancelSchedule(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return {
      success: true,
      data: await this.orders.cancelScheduled(user.sub, id),
    };
  }
}
