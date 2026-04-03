import { SessionManager } from "../session/SessionManager";
import { AppError } from "../utils/errors";
import { buildGroupSendMessageRequest } from "./group-message-helpers";

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

  public async sendMessage(userId: string, sessionId: string, body: unknown): Promise<unknown> {
    const socket = this.sessionManager.getInstance(sessionId, userId).requireSocket();
    const payload = buildGroupSendMessageRequest(body);

    try {
      const providerResult = await socket.sendMessage(payload.groupJid, payload.content as any);
      return {
        message: {
          groupJid: payload.groupJid,
          type: payload.type,
          text: payload.message,
          imageUrl: payload.imageUrl
        },
        provider: providerResult?.key?.id ? { id: providerResult.key.id } : null
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        500,
        "GROUP_MESSAGE_SEND_FAILED",
        error instanceof Error ? error.message : "Failed to send group message"
      );
    }
  }
}
