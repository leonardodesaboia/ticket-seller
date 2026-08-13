import { Controller, Get, HttpCode, Param, UseGuards } from '@nestjs/common';
import { ActorGuard } from '../../../../platform/http/guards/actor.guard';
import { GetEventAttendanceUseCase } from '../../application/use-cases/get-event-attendance.use-case';
import { EventAttendanceResponseDto } from '../dto/event-attendance.response';

@Controller('organizations/:orgId/events/:eventId')
@UseGuards(ActorGuard)
export class EventAttendanceController {
  constructor(private readonly getEventAttendance: GetEventAttendanceUseCase) {}

  @Get('attendance')
  @HttpCode(200)
  async getAttendance(
    @Param('orgId') orgId: string,
    @Param('eventId') eventId: string,
  ): Promise<EventAttendanceResponseDto> {
    const result = await this.getEventAttendance.execute(orgId, eventId);

    return {
      totalIssued: result.totalIssued,
      totalAdmitted: result.totalAdmitted,
      totalRemaining: result.totalRemaining,
      attendanceRate: result.attendanceRate,
      byTicketType: result.byTicketType.map((t) => ({
        ticketTypeId: t.ticketTypeId,
        ticketTypeName: t.ticketTypeName,
        totalIssued: t.totalIssued,
        totalAdmitted: t.totalAdmitted,
      })),
      recentCheckIns: result.recentCheckIns.map((ci) => ({
        checkedInAt: ci.checkedInAt.toISOString(),
        ticketTypeName: ci.ticketTypeName,
        performedByUserId: ci.performedByUserId,
      })),
    };
  }
}
