import type { DatabaseService } from "../database/DatabaseService";
import type { TemplateRecord, TemplateType } from "../types/models";
import { AppError } from "../utils/errors";

export class TemplateService {
  public constructor(private readonly databaseService: DatabaseService) {}

  public list(userId: string): TemplateRecord[] {
    return this.databaseService.templates.listByUserId(userId);
  }

  public get(templateId: string, userId: string): TemplateRecord {
    const template = this.databaseService.templates.findById(templateId, userId);
    if (!template) {
      throw new AppError(404, "NOT_FOUND", "Template not found");
    }
    return template;
  }

  public create(userId: string, input: { name: string; type: TemplateType; content: string; variables: string[] }): TemplateRecord {
    return this.databaseService.templates.create({
      id: crypto.randomUUID(),
      userId,
      name: input.name,
      type: input.type,
      content: input.content,
      variables: JSON.stringify(input.variables)
    });
  }

  public update(userId: string, id: string, input: Partial<{ name: string; type: TemplateType; content: string; variables: string[] }>): TemplateRecord {
    const updateInput: Partial<TemplateRecord> = {};
    if (input.name !== undefined) updateInput.name = input.name;
    if (input.type !== undefined) updateInput.type = input.type;
    if (input.content !== undefined) updateInput.content = input.content;
    if (input.variables !== undefined) updateInput.variables = JSON.stringify(input.variables);
    const updated = this.databaseService.templates.update(id, userId, updateInput);
    if (!updated) {
      throw new AppError(404, "NOT_FOUND", "Template not found");
    }
    return updated;
  }

  public destroy(userId: string, id: string): void {
    if (!this.databaseService.templates.delete(id, userId)) {
      throw new AppError(404, "NOT_FOUND", "Template not found");
    }
  }
}
