let sequence = 0;

export function createLocalRecordId(
  prefix:
    | 'equipment'
    | 'mask'
    | 'mask-operation'
    | 'panorama'
    | 'panorama-draft'
    | 'profile'
    | 'tile',
): string {
  sequence = (sequence + 1) % 1_000_000;
  const timestamp = Date.now().toString(36);
  const random = Math.floor(Math.random() * 0x100000000)
    .toString(36)
    .padStart(7, '0');
  return `${prefix}-${timestamp}-${sequence.toString(36)}-${random}`;
}
