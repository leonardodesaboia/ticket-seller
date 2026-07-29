import { ApiProperty } from '@nestjs/swagger';
import type { Organization } from '../../domain/organization.entity';

export class OrganizationResponse {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() status!: string;
  @ApiProperty() createdAt!: string;

  static from(org: Organization): OrganizationResponse {
    const res = new OrganizationResponse();
    res.id = org.id;
    res.name = org.name;
    res.slug = org.slug;
    res.status = org.status;
    res.createdAt = org.createdAt.toISOString();
    return res;
  }
}
