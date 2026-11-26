import type { Logger } from '@nestjs/common';
import { StorageProvider } from './storage.provider';

// Remove arquivos de registros já excluídos do banco. Uma falha só fica no log: o registro já não existe e o arquivo vira órfão.
export async function removeStoredFiles (storageProvider: StorageProvider, keys: string[], logger: Logger) {
  await Promise.all(keys.map(key => storageProvider.remove(key).catch(() => logger.warn(`Não foi possível remover o arquivo do storage. key=${key}`))));
}
