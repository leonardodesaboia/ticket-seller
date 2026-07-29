import { ApiProperty } from '@nestjs/swagger';
import type {
  PublicationReadiness,
  PublicationReadinessIssue,
} from '../../domain/publication/publication-readiness.policy';

export class PublicationReadinessIssueResponse {
  @ApiProperty() code!: string;
  @ApiProperty() field!: string;
  @ApiProperty() section!: string;
  @ApiProperty() message!: string;

  static from(issue: PublicationReadinessIssue): PublicationReadinessIssueResponse {
    const response = new PublicationReadinessIssueResponse();
    response.code = issue.code;
    response.field = issue.field;
    response.section = issue.section;
    response.message = issue.message;
    return response;
  }
}

export class PublicationReadinessResponse {
  @ApiProperty() ready!: boolean;
  @ApiProperty() version!: number;
  @ApiProperty({ type: [PublicationReadinessIssueResponse] })
  issues!: PublicationReadinessIssueResponse[];

  static from(readiness: PublicationReadiness): PublicationReadinessResponse {
    const response = new PublicationReadinessResponse();
    response.ready = readiness.ready;
    response.version = readiness.version;
    response.issues = readiness.issues.map(PublicationReadinessIssueResponse.from);
    return response;
  }
}
