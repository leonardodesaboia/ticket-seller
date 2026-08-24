import { IsEmail, IsIn, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { VALID_ORGANIZATION_ROLES } from '../../../../shared/kernel/organization-capability';

export class InviteMemberDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: VALID_ORGANIZATION_ROLES })
  @IsString()
  @IsIn(VALID_ORGANIZATION_ROLES)
  role!: string;
}
