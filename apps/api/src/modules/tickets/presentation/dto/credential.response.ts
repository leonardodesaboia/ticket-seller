import { ApiProperty } from '@nestjs/swagger';

export class CredentialResponse {
  @ApiProperty() credentialToken!: string;
  @ApiProperty() version!: number;
  @ApiProperty() ticketId!: string;
}
