import { API_PREFIX } from "../config/constants";
import { ApiKeyController } from "../controllers/ApiKeyController";
import { AuthController } from "../controllers/AuthController";
import { BroadcastController } from "../controllers/BroadcastController";
import { GroupController } from "../controllers/GroupController";
import { MessageController } from "../controllers/MessageController";
import { SessionController } from "../controllers/SessionController";
import { TemplateController } from "../controllers/TemplateController";
import { WebhookController } from "../controllers/WebhookController";
import type { DatabaseService } from "../database/DatabaseService";
import { requireAuth, requireJwtAuth } from "../middlewares/auth";
import { AppRouter } from "./AppRouter";

export function registerRoutes(
  router: AppRouter,
  databaseService: DatabaseService,
  controllers: {
    authController: AuthController;
    apiKeyController: ApiKeyController;
    sessionController: SessionController;
    messageController: MessageController;
    groupController: GroupController;
    templateController: TemplateController;
    broadcastController: BroadcastController;
    webhookController: WebhookController;
  }
): void {
  const humanOnly = requireJwtAuth(databaseService);
  const sessionRead = requireAuth(databaseService, ["read_status"]);
  const sessionManage = requireAuth(databaseService, ["manage_session"]);
  const messageSend = requireAuth(databaseService, ["send_message"]);
  const templateManage = requireAuth(databaseService, ["manage_template"]);

  router.register("POST", `${API_PREFIX}/auth/register`, controllers.authController.register);
  router.register("POST", `${API_PREFIX}/auth/login`, controllers.authController.login);
  router.register("POST", `${API_PREFIX}/auth/logout`, humanOnly(controllers.authController.logout));
  router.register("POST", `${API_PREFIX}/auth/refresh-token`, controllers.authController.refreshToken);
  router.register("GET", `${API_PREFIX}/auth/me`, humanOnly(controllers.authController.me));

  router.register("GET", `${API_PREFIX}/apikeys`, humanOnly(controllers.apiKeyController.list));
  router.register("POST", `${API_PREFIX}/apikeys/generate`, humanOnly(controllers.apiKeyController.generate));
  router.register("GET", `${API_PREFIX}/apikey/view/:id`, humanOnly(controllers.apiKeyController.view));
  router.register("POST", `${API_PREFIX}/apikeys/generate/:id`, humanOnly(controllers.apiKeyController.regenerate));
  router.register("PATCH", `${API_PREFIX}/apikeys/:id/revoke`, humanOnly(controllers.apiKeyController.revoke));
  router.register("DELETE", `${API_PREFIX}/apikeys/:id`, humanOnly(controllers.apiKeyController.destroy));

  router.register("POST", `${API_PREFIX}/sessions`, sessionManage(controllers.sessionController.create));
  router.register("GET", `${API_PREFIX}/sessions`, sessionRead(controllers.sessionController.list));
  router.register("GET", `${API_PREFIX}/sessions/:id`, sessionRead(controllers.sessionController.detail));
  router.register("GET", `${API_PREFIX}/sessions/:id/status`, sessionRead(controllers.sessionController.status));
  router.register("GET", `${API_PREFIX}/sessions/:id/qr`, sessionRead(controllers.sessionController.qr));
  router.register("GET", `${API_PREFIX}/sessions/:id/info`, sessionRead(controllers.sessionController.info));
  router.register("POST", `${API_PREFIX}/sessions/:id/connect`, sessionManage(controllers.sessionController.connect));
  router.register("POST", `${API_PREFIX}/sessions/:id/disconnect`, sessionManage(controllers.sessionController.disconnect));
  router.register("PATCH", `${API_PREFIX}/sessions/:id`, sessionManage(controllers.sessionController.update));
  router.register("PATCH", `${API_PREFIX}/sessions/:id/update`, sessionManage(controllers.sessionController.update));
  router.register("PATCH", `${API_PREFIX}/sessions/:id/phone`, sessionManage(controllers.sessionController.updatePhoneNumber));
  router.register("PATCH", `${API_PREFIX}/sessions/:id/webhook`, sessionManage(controllers.sessionController.updateWebhook));
  router.register("DELETE", `${API_PREFIX}/sessions/:id`, sessionManage(controllers.sessionController.destroy));

  router.register("POST", `${API_PREFIX}/sessions/:id/messages/text`, messageSend(controllers.messageController.sendText));
  router.register("POST", `${API_PREFIX}/sessions/:id/messages/media`, messageSend(controllers.messageController.sendMedia));
  router.register("POST", `${API_PREFIX}/sessions/:id/messages/image`, messageSend(controllers.messageController.sendImage));
  router.register("POST", `${API_PREFIX}/sessions/:id/messages/video`, messageSend(controllers.messageController.sendVideo));
  router.register("POST", `${API_PREFIX}/sessions/:id/messages/audio`, messageSend(controllers.messageController.sendAudio));
  router.register("POST", `${API_PREFIX}/sessions/:id/messages/document`, messageSend(controllers.messageController.sendDocument));
  router.register("POST", `${API_PREFIX}/sessions/:id/messages/location`, messageSend(controllers.messageController.sendLocation));
  router.register("POST", `${API_PREFIX}/sessions/:id/messages/contact`, messageSend(controllers.messageController.sendContact));
  router.register("POST", `${API_PREFIX}/sessions/:id/messages/buttons`, messageSend(controllers.messageController.sendButtons));
  router.register("POST", `${API_PREFIX}/sessions/:id/messages/list`, messageSend(controllers.messageController.sendList));
  router.register("POST", `${API_PREFIX}/sessions/:id/messages/bulk`, messageSend(controllers.messageController.sendBulk));
  router.register("POST", `${API_PREFIX}/sessions/:id/messages/template`, messageSend(controllers.messageController.sendTemplate));

  router.register("GET", `${API_PREFIX}/templates`, templateManage(controllers.templateController.list));
  router.register("POST", `${API_PREFIX}/templates`, templateManage(controllers.templateController.create));
  router.register("PUT", `${API_PREFIX}/templates/:id`, templateManage(controllers.templateController.update));
  router.register("DELETE", `${API_PREFIX}/templates/:id`, templateManage(controllers.templateController.destroy));

  router.register("POST", `${API_PREFIX}/broadcasts`, messageSend(controllers.broadcastController.create));
  router.register("GET", `${API_PREFIX}/broadcasts`, sessionRead(controllers.broadcastController.list));
  router.register("GET", `${API_PREFIX}/broadcasts/:id/report`, sessionRead(controllers.broadcastController.report));

  router.register("POST", `${API_PREFIX}/webhooks`, templateManage(controllers.webhookController.create));
  router.register("GET", `${API_PREFIX}/webhooks`, templateManage(controllers.webhookController.list));
  router.register("DELETE", `${API_PREFIX}/webhooks/:id`, templateManage(controllers.webhookController.destroy));

  router.register("GET", `${API_PREFIX}/sessions/:id/groups`, sessionRead(controllers.groupController.list));
  router.register("GET", `${API_PREFIX}/sessions/:id/groups/:groupId/members`, sessionRead(controllers.groupController.listMembers));
  router.register("POST", `${API_PREFIX}/sessions/:id/groups/messages`, messageSend(controllers.groupController.sendMessage));
}
