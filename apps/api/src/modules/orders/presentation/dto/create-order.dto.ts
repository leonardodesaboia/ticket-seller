import { IsEmail, IsUUID } from 'class-validator';

export class CreateOrderDto {
  @IsUUID('4')
  reservationId!: string;

  @IsEmail()
  buyerEmail!: string;
}
