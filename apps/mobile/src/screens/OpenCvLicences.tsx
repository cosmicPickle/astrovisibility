import { useState } from 'react';

import { ActionButton } from '../components/ui/ActionButton';
import { AppText } from '../components/ui/AppText';
import { ModalSheet } from '../components/ui/ModalSheet';
import { SectionCard } from '../components/ui/SectionCard';
import { readPanoramaLicences } from '../panorama/panoramaStitching';

export function OpenCvLicences() {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const open = async () => {
    setLoading(true);
    try {
      setText(await readPanoramaLicences());
    } catch {
      setText(
        'Licences could not be opened. Please close this sheet and try again in the Android app.',
      );
    } finally {
      setLoading(false);
    }
  };
  return (
    <>
      <SectionCard>
        <AppText tone="label">OpenCV 4.13.0 · MediaPipe 1.0.0</AppText>
        <AppText>
          Panorama stitching uses OpenCV. Magic masking uses MediaPipe and
          Google's MagicTouch model. These are licensed under Apache 2.0. Images
          are processed on this device; the model is included in the app.
        </AppText>
        <ActionButton
          label="Open panorama licences"
          loading={loading}
          onPress={() => void open()}
          variant="secondary"
        />
      </SectionCard>
      <ModalSheet
        title="Image processing licences"
        closeAccessibilityLabel="Close OpenCV licences"
        visible={text !== null}
        onClose={() => setText(null)}
      >
        <AppText selectable>{text}</AppText>
      </ModalSheet>
    </>
  );
}
