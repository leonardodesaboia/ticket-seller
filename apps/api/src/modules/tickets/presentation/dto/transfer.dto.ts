export class InitiateTransferResponse {
  claimToken!: string;
  expiresAt!: string; // ISO 8601
}

export class AcceptTransferResponse {
  newCredentialToken!: string;
}
