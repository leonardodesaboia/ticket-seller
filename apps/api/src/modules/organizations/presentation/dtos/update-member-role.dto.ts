import { IsIn, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { VALID_ORGANIZATION_ROLES } from '../../../../shared/kernel/organization-capability';

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: VALID_ORGANIZATION_ROLES })
  @IsString()
  @IsIn(VALID_ORGANIZATION_ROLES)
  role!: string;
}
