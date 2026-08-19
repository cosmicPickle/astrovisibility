import { useMemo } from 'react';
import {
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import type { CapturedProofTile } from '../../capture/captureSession';
import { normalizeAzimuthDegrees } from '../../sky/projection';
import { colors } from '../../theme/tokens';
import { AppText } from '../ui/AppText';

const WORLD_WIDTH_PIXELS = 720;
const WORLD_HEIGHT_PIXELS = 300;

type CapturedTileMosaicProps = {
  tiles: CapturedProofTile[];
  selectedTileId: string | null;
  onSelectTile: (tileId: string) => void;
  onDragTile?: (
    tileId: string,
    correction: {
      azimuthDeltaDegrees: number;
      altitudeDeltaDegrees: number;
    },
  ) => void;
};

export const CapturedTileMosaic = ({
  tiles,
  selectedTileId,
  onSelectTile,
  onDragTile,
}: CapturedTileMosaicProps) => (
  <ScrollView
    accessibilityLabel="Captured tiles placed by reviewed sky direction"
    horizontal
    showsHorizontalScrollIndicator
    style={styles.scroller}
  >
    <View style={styles.world}>
      {[0, 30, 60, 90].map((altitudeDegrees) => (
        <View
          key={altitudeDegrees}
          style={[
            styles.altitudeGuide,
            {
              top: ((90 - altitudeDegrees) / 90) * WORLD_HEIGHT_PIXELS,
            },
          ]}
        />
      ))}
      {tiles.flatMap((tile) => {
        const widthPixels =
          (tile.reviewedPlacement.horizontalFieldOfViewDegrees / 360) *
          WORLD_WIDTH_PIXELS;
        const heightPixels =
          (tile.reviewedPlacement.verticalFieldOfViewDegrees / 90) *
          WORLD_HEIGHT_PIXELS;
        const centerX =
          (normalizeAzimuthDegrees(
            tile.reviewedPlacement.centerAzimuthDegrees,
          ) /
            360) *
          WORLD_WIDTH_PIXELS;
        const centerY =
          ((90 - tile.reviewedPlacement.centerAltitudeDegrees) / 90) *
          WORLD_HEIGHT_PIXELS;
        return [-WORLD_WIDTH_PIXELS, 0, WORLD_WIDTH_PIXELS].map((offset) => (
          <MosaicTile
            accessibilityLabel={`Select captured tile at ${Math.round(tile.reviewedPlacement.centerAzimuthDegrees)} degrees azimuth`}
            imageUri={tile.uri}
            key={`${tile.id}-${offset}`}
            onDrag={(translationXPixels, translationYPixels) =>
              onDragTile?.(tile.id, {
                azimuthDeltaDegrees:
                  (translationXPixels / WORLD_WIDTH_PIXELS) * 360,
                altitudeDeltaDegrees:
                  (-translationYPixels / WORLD_HEIGHT_PIXELS) * 90,
              })
            }
            onSelect={() => onSelectTile(tile.id)}
            selected={selectedTileId === tile.id}
            style={[
              {
                height: heightPixels,
                left: centerX - widthPixels / 2 + offset,
                top: centerY - heightPixels / 2,
                transform: [
                  { rotate: `${tile.reviewedPlacement.rollDegrees}deg` },
                ],
                width: widthPixels,
              },
            ]}
          />
        ));
      })}
      <View style={styles.cardinals} pointerEvents="none">
        {['N', 'E', 'S', 'W'].map((label) => (
          <AppText key={label} style={styles.cardinal} tone="label">
            {label}
          </AppText>
        ))}
      </View>
    </View>
  </ScrollView>
);

const MosaicTile = ({
  accessibilityLabel,
  imageUri,
  onDrag,
  onSelect,
  selected,
  style,
}: {
  accessibilityLabel: string;
  imageUri: string;
  onDrag: (translationXPixels: number, translationYPixels: number) => void;
  onSelect: () => void;
  selected: boolean;
  style: object;
}) => {
  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          selected && Math.abs(gesture.dx) + Math.abs(gesture.dy) > 4,
        onPanResponderRelease: (_, gesture) => onDrag(gesture.dx, gesture.dy),
      }),
    [onDrag, selected],
  );
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onSelect}
      style={[styles.tile, selected && styles.tileSelected, style]}
      {...responder.panHandlers}
    >
      <Image source={{ uri: imageUri }} style={styles.image} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  altitudeGuide: {
    borderTopColor: colors.outline,
    borderTopWidth: 1,
    left: 0,
    position: 'absolute',
    width: WORLD_WIDTH_PIXELS,
  },
  cardinal: {
    textAlign: 'center',
    width: WORLD_WIDTH_PIXELS / 4,
  },
  cardinals: {
    flexDirection: 'row',
    left: 0,
    position: 'absolute',
    top: 6,
  },
  image: {
    height: '100%',
    opacity: 0.72,
    width: '100%',
  },
  scroller: {
    backgroundColor: colors.backdrop,
    borderColor: colors.outline,
    borderWidth: 1,
    height: WORLD_HEIGHT_PIXELS,
  },
  tile: {
    borderColor: colors.primary,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'absolute',
  },
  tileSelected: {
    borderColor: colors.spaceViolet,
    borderWidth: 3,
  },
  world: {
    backgroundColor: colors.backdrop,
    height: WORLD_HEIGHT_PIXELS,
    overflow: 'hidden',
    width: WORLD_WIDTH_PIXELS,
  },
});
