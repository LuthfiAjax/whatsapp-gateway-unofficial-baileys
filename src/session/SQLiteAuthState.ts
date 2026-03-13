import {
  BufferJSON,
  initAuthCreds,
  makeCacheableSignalKeyStore,
  proto,
  type AuthenticationCreds,
  type AuthenticationState,
  type SignalDataSet,
  type SignalDataTypeMap
} from "baileys";
import { DatabaseService } from "../database/DatabaseService";

type AuthKeysShape = Partial<Record<keyof SignalDataTypeMap, Record<string, unknown>>>;

function reviveKey(type: keyof SignalDataTypeMap, value: unknown): unknown {
  if (type === "app-state-sync-key" && value) {
    return proto.Message.AppStateSyncKeyData.fromObject(value as Record<string, unknown>);
  }
  return value;
}

export class SQLiteAuthState {
  private creds: AuthenticationCreds;
  private keys: AuthKeysShape;

  public constructor(
    private readonly sessionId: string,
    private readonly databaseService: DatabaseService
  ) {
    const record = this.databaseService.sessions.getAuthState(sessionId);
    this.creds = record ? JSON.parse(record.creds, BufferJSON.reviver) : initAuthCreds();
    this.keys = record ? (JSON.parse(record.keys, BufferJSON.reviver) as AuthKeysShape) : {};
  }

  public get state(): AuthenticationState {
    return {
      creds: this.creds,
      keys: makeCacheableSignalKeyStore(
        {
          get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
            const data: Record<string, SignalDataTypeMap[T]> = {};
            const keyBucket = (this.keys[type] ?? {}) as Record<string, unknown>;
            for (const id of ids) {
              const value = keyBucket[id];
              if (value) {
                data[id] = reviveKey(type, value) as SignalDataTypeMap[T];
              }
            }
            return data;
          },
          set: async (data: SignalDataSet) => {
            for (const type of Object.keys(data) as Array<keyof SignalDataTypeMap>) {
              const current = ((this.keys[type] ?? {}) as Record<string, unknown>);
              for (const [id, value] of Object.entries(data[type] ?? {})) {
                if (value) {
                  current[id] = value;
                } else {
                  delete current[id];
                }
              }
              this.keys[type] = current;
            }
            this.persist();
          }
        },
        undefined
      )
    };
  }

  public saveCreds(): void {
    this.persist();
  }

  public clear(): void {
    this.creds = initAuthCreds();
    this.keys = {};
    this.databaseService.sessions.clearAuthState(this.sessionId);
  }

  private persist(): void {
    this.databaseService.sessions.saveAuthState(
      this.sessionId,
      JSON.stringify(this.creds, BufferJSON.replacer),
      JSON.stringify(this.keys, BufferJSON.replacer)
    );
  }
}
