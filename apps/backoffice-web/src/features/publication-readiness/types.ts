export interface ReadinessIssue {
  code: string;
  field: string;
  section: string;
  message: string;
}

export interface PublicationReadiness {
  ready: boolean;
  version: number;
  issues: ReadinessIssue[];
}
