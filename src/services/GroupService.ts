import { SessionManager } from "../session/SessionManager";

export class GroupService {
  public constructor(private readonly sessionManager: SessionManager) {}

  public async listGroups(userId: string, sessionId: string): Promise<unknown> {
    const socket = this.sessionManager.getInstance(sessionId, userId).requireSocket();
    const groups = await socket.groupFetchAllParticipating();
    return Object.values(groups).map((group) => ({
      id: group.id,
      subject: group.subject,
      subjectOwner: group.subjectOwner,
      subjectTime: group.subjectTime,
      size: group.size,
      owner: group.owner,
      announce: group.announce,
      restrict: group.restrict,
      creation: group.creation,
      desc: group.desc
    }));
  }

  public async listMembers(userId: string, sessionId: string, groupId: string): Promise<unknown> {
    const socket = this.sessionManager.getInstance(sessionId, userId).requireSocket();
    const metadata = await socket.groupMetadata(groupId);
    return {
      id: metadata.id,
      subject: metadata.subject,
      size: metadata.size,
      participants: metadata.participants.map((participant) => ({
        id: participant.id,
        admin: participant.admin ?? null
      }))
    };
  }
}
