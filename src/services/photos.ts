/**
 * Fotos de registro do treino.
 *
 * Cada foto vai para dois lugares, os dois NO CELULAR:
 *
 *   1. a galeria, onde o usuário guarda as outras fotos;
 *   2. uma cópia na pasta privada do app, ligada ao treino — é o que
 *      permite mostrar a foto no card do dia e na tela do treino.
 *
 * Nada sobe para o Firebase: sem custo de armazenamento e em
 * qualidade total. Em troca, as fotos existem só neste aparelho e
 * somem do app se ele for desinstalado (na galeria, continuam).
 *
 * A cópia é necessária porque o app só tem permissão para SALVAR na
 * galeria, não para ler — então não teria como reencontrar a foto lá.
 *
 * A própria pasta serve de índice: `workout-photos/<id do treino>/`,
 * um arquivo por foto, com o nome sendo o instante em que foi tirada.
 */
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { AppError } from '../lib/errors';

/** Câmera, galeria e pasta do app só existem no celular, não no navegador. */
export const canTakeWorkoutPhoto = Platform.OS !== 'web';

const ROOT = 'workout-photos';

function rootDirectory(): Directory {
  return new Directory(Paths.document, ROOT);
}

function sessionDirectory(sessionId: string): Directory {
  return new Directory(Paths.document, ROOT, sessionId);
}

/** Endereços das fotos de um diretório, da mais antiga para a mais nova. */
function photosIn(directory: Directory): string[] {
  if (!directory.exists) return [];
  return directory
    .list()
    .filter((item): item is File => item instanceof File)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((file) => file.uri);
}

/**
 * Todas as fotos guardadas no app, agrupadas por treino.
 *
 * Leitura local e síncrona; envolvida em consulta do TanStack Query
 * (`useWorkoutPhotos`) só para as telas se atualizarem juntas quando
 * uma foto nova é tirada.
 */
export function listWorkoutPhotos(): Record<string, string[]> {
  if (!canTakeWorkoutPhoto) return {};

  const root = rootDirectory();
  if (!root.exists) return {};

  const bySession: Record<string, string[]> = {};
  for (const item of root.list()) {
    if (!(item instanceof Directory)) continue;
    const photos = photosIn(item);
    if (photos.length > 0) bySession[item.name] = photos;
  }
  return bySession;
}

export interface SavedPhoto {
  /** Cópia guardada no app, para exibir. */
  uri: string;
  /** false se o usuário negou a galeria: a foto ficou só no app. */
  savedToGallery: boolean;
}

/**
 * Abre a câmera e guarda a foto no app e na galeria.
 *
 * @returns a foto guardada, ou null se o usuário fechou a câmera sem
 *          fotografar.
 */
export async function takeWorkoutPhoto(sessionId: string): Promise<SavedPhoto | null> {
  const camera = await ImagePicker.requestCameraPermissionsAsync();
  if (!camera.granted) {
    throw new AppError(
      'permission',
      'Sem acesso à câmera. Libere a permissão nos Ajustes do celular para tirar a foto.',
    );
  }

  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 });
  const taken = result.canceled ? null : (result.assets[0]?.uri ?? null);
  if (!taken) return null;

  // 1. Cópia do app. Vem primeiro porque não depende de permissão:
  // mesmo que a galeria seja negada, a foto do treino não se perde.
  let uri: string;
  try {
    const directory = sessionDirectory(sessionId);
    directory.create({ intermediates: true, idempotent: true });
    const destination = new File(directory, `${Date.now()}.jpg`);
    new File(taken).copy(destination);
    uri = destination.uri;
  } catch (error) {
    throw new AppError('unknown', 'Não foi possível guardar a foto.', error);
  }

  // 2. Galeria. Carregado só aqui: o módulo emite um aviso no Expo Go
  // assim que é importado, e não há motivo para mostrá-lo a quem nunca
  // tira foto.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const MediaLibrary = require('expo-media-library') as typeof import('expo-media-library');

  try {
    // Só escrita, só fotos: o app não pede para LER a galeria.
    const library = await MediaLibrary.requestPermissionsAsync(true, ['photo']);
    if (!library.granted) return { uri, savedToGallery: false };
    await MediaLibrary.saveToLibraryAsync(taken);
    return { uri, savedToGallery: true };
  } catch {
    return { uri, savedToGallery: false };
  }
}
