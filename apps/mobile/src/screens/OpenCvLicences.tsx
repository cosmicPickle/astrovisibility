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
        <AppText tone="label">OpenCV 4.13.0</AppText>
        <AppText>
          Automatic panorama matching and blending use OpenCV, licensed under
          Apache 2.0. Processing runs on this device.
        </AppText>
        <ActionButton
          label="Open panorama licences"
          loading={loading}
          onPress={() => void open()}
          variant="secondary"
        />
      </SectionCard>
      <ModalSheet
        title="OpenCV licences"
        closeAccessibilityLabel="Close OpenCV licences"
        visible={text !== null}
        onClose={() => setText(null)}
      >
        <AppText selectable>{text}</AppText>
      </ModalSheet>
    </>
  );
}
