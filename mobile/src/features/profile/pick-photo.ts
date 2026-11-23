import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

const SIZE = 256;

export type PhotoSource = 'library' | 'camera';

/**
 * Lets the user pick or take a square photo and returns it as a small base64 JPEG
 * (256×256, ~15–40 KB) — the server stores only this, never the original.
 * Returns null when cancelled; throws a Mongolian message when permission is denied.
 */
export async function pickProfilePhoto(source: PhotoSource): Promise<string | null> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error(
      source === 'camera'
        ? 'Камер ашиглах зөвшөөрөл өгөөгүй байна. Утасны тохиргооноос зөвшөөрнө үү.'
        : 'Зургийн санд хандах зөвшөөрөл өгөөгүй байна. Утасны тохиргооноос зөвшөөрнө үү.',
    );
  }
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets[0]) return null;

  const image = await ImageManipulator.manipulate(result.assets[0].uri)
    .resize({ width: SIZE, height: SIZE })
    .renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  if (!saved.base64) throw new Error('Зургийг боловсруулж чадсангүй.');
  return saved.base64;
}
