import { MessageService } from "../services/MessageService";
import type { RequestContext } from "../types/api";
import { json } from "../utils/http";
import { requireParam } from "../utils/validation";

export class MessageController {
  public constructor(private readonly messageService: MessageService) {}

  public sendText = async (ctx: RequestContext): Promise<Response> => json(await this.messageService.sendText(ctx.userId!, requireParam(ctx.params, "id"), ctx.body));
  public sendMedia = async (ctx: RequestContext): Promise<Response> => json(await this.messageService.sendMedia(ctx.userId!, requireParam(ctx.params, "id"), ctx.body));
  public sendImage = async (ctx: RequestContext): Promise<Response> => json(await this.messageService.sendImage(ctx.userId!, requireParam(ctx.params, "id"), ctx.body));
  public sendVideo = async (ctx: RequestContext): Promise<Response> => json(await this.messageService.sendVideo(ctx.userId!, requireParam(ctx.params, "id"), ctx.body));
  public sendAudio = async (ctx: RequestContext): Promise<Response> => json(await this.messageService.sendAudio(ctx.userId!, requireParam(ctx.params, "id"), ctx.body));
  public sendDocument = async (ctx: RequestContext): Promise<Response> => json(await this.messageService.sendDocument(ctx.userId!, requireParam(ctx.params, "id"), ctx.body));
  public sendLocation = async (ctx: RequestContext): Promise<Response> => json(await this.messageService.sendLocation(ctx.userId!, requireParam(ctx.params, "id"), ctx.body));
  public sendContact = async (ctx: RequestContext): Promise<Response> => json(await this.messageService.sendContact(ctx.userId!, requireParam(ctx.params, "id"), ctx.body));
  public sendButtons = async (ctx: RequestContext): Promise<Response> => json(await this.messageService.sendButtons(ctx.userId!, requireParam(ctx.params, "id"), ctx.body));
  public sendList = async (ctx: RequestContext): Promise<Response> => json(await this.messageService.sendList(ctx.userId!, requireParam(ctx.params, "id"), ctx.body));
  public sendBulk = async (ctx: RequestContext): Promise<Response> => json(await this.messageService.sendBulk(ctx.userId!, requireParam(ctx.params, "id"), ctx.body));
  public sendTemplate = async (ctx: RequestContext): Promise<Response> => json(await this.messageService.sendTemplate(ctx.userId!, requireParam(ctx.params, "id"), ctx.body));
}
