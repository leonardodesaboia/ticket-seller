export const EVENT_ACCESS_FOR_CHECKIN_PORT = Symbol('EVENT_ACCESS_FOR_CHECKIN_PORT');

export interface EventForCheckIn {
  id: string;
  organizationId: string;
  status: string;
}

export interface IEventAccessForCheckInPort {
  /**
   * Find event by id and organizationId for check-in.
   * Returns null if the event does not belong to the organization.
   */
  findEventForCheckIn(eventId: string, organizationId: string): Promise<EventForCheckIn | null>;
}
