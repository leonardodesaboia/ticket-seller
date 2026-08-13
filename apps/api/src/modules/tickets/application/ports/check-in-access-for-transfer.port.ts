export interface ICheckInAccessForTransferPort {
  hasAdmittedCheckIn(ticketId: string): Promise<boolean>;
}

export const CHECK_IN_ACCESS_FOR_TRANSFER_PORT = Symbol('CHECK_IN_ACCESS_FOR_TRANSFER_PORT');
