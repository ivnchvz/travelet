import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Texture } from './Texture';
import { ObjectType } from './theme';

const MONO = 'SpaceMono';

/**
 * The inside surface of each object, continuing the cover's design:
 * passport → double-page spread, boarding pass → ticket sleeve,
 * visa → passport visa page, insurance → unfolded bifold wallet,
 * folder → opened manila folder. Purely decorative (pointerEvents none).
 */
export function InteriorChrome({ type, name }: { type: ObjectType; name: string }) {
  switch (type) {
    case 'passport':
      return (
        <View style={s.fill} pointerEvents="none">
          <View style={[s.fill, { backgroundColor: '#f6efdf' }]} />
          <Texture variant="paper" />
          {/* inside of the cover (the flattened cover hands off to this) */}
          <View style={s.endpaper}>
            <View style={[s.fill, { backgroundColor: '#7a2f42' }]} />
            <Texture variant="leather" opacity={0.4} />
            <LinearGradient
              colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.18)']}
              start={{ x: 0.6, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
          {/* center spine of the open book */}
          <LinearGradient
            colors={['rgba(90,70,50,0)', 'rgba(90,70,50,0.22)', 'rgba(90,70,50,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.spine}
          />
          {/* page edge stack on the open side */}
          <View style={[s.pageEdge, { right: 4 }]} />
          <View style={[s.pageEdge, { right: 7 }]} />
        </View>
      );

    case 'boardingPass':
      return (
        <View style={s.fill} pointerEvents="none">
          <View style={[s.fill, { backgroundColor: '#fcfdf9' }]} />
          <LinearGradient
            colors={['#16a34a', '#4ade80']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.sleeveBar}
          >
            <Ionicons name="airplane" size={12} color="#fff" />
            <Text style={s.sleeveBarText}>TRAVELET AIR · DOCUMENT SLEEVE</Text>
          </LinearGradient>
          <View style={s.sleevePerforation} />
        </View>
      );

    case 'visa':
      return (
        <View style={s.fill} pointerEvents="none">
          <LinearGradient
            colors={['#e7f1ff', '#d6e7fd', '#eaf3ff']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.fill}
          />
          <View style={[s.visaBand, { top: '22%' }]} />
          <View style={[s.visaBand, { top: '52%' }]} />
          <Text style={s.visaWatermark}>VISA</Text>
          <View style={s.visaMrz}>
            <Text style={s.visaMrzText} numberOfLines={1}>
              {('V<TVL' + name.toUpperCase().replace(/[^A-Z0-9]/g, '<') + '<'.repeat(40)).slice(0, 38)}
            </Text>
          </View>
        </View>
      );

    case 'insurance':
      return (
        <View style={s.fill} pointerEvents="none">
          <LinearGradient
            colors={['#ddd3ff', '#cfc2fb']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.fill}
          />
          {/* fold stitch across the middle of the unfolded wallet */}
          <View style={s.walletStitch} />
          <Ionicons
            name="medkit"
            size={90}
            color="rgba(124,58,237,0.08)"
            style={s.walletWatermark}
          />
          <View style={s.walletHighlight} />
        </View>
      );

    case 'folder':
      return (
        <View style={s.fill} pointerEvents="none">
          <View style={[s.fill, { backgroundColor: '#eed3a0' }]} />
          <Texture variant="cardboard" />
          {/* inner pocket */}
          <View style={s.folderPocket}>
            <Text style={s.folderPocketText} numberOfLines={1}>
              {name.toUpperCase()}
            </Text>
          </View>
          <Ionicons
            name="attach"
            size={20}
            color="rgba(122,92,46,0.4)"
            style={{ position: 'absolute', top: 8, right: 10, transform: [{ rotate: '30deg' }] }}
          />
        </View>
      );
  }
}

const s = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
  // passport spread
  endpaper: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '50%',
    overflow: 'hidden',
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
  },
  spine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 26,
    marginLeft: -13,
  },
  pageEdge: {
    position: 'absolute',
    top: 5,
    bottom: 5,
    width: 1,
    backgroundColor: 'rgba(90,70,50,0.12)',
  },
  stamp: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  stampText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  pageNo: {
    position: 'absolute',
    bottom: 8,
    fontSize: 8,
    fontFamily: MONO,
    color: 'rgba(90,70,50,0.4)',
  },
  // boarding pass sleeve
  sleeveBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  sleeveBarText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
    color: '#ffffff',
  },
  sleevePerforation: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 22,
    height: 2,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
  },
  // visa page
  visaBand: {
    position: 'absolute',
    left: -30,
    right: -30,
    height: 30,
    backgroundColor: 'rgba(59,130,246,0.05)',
    transform: [{ rotate: '-8deg' }],
  },
  visaWatermark: {
    position: 'absolute',
    top: 10,
    right: 16,
    fontSize: 54,
    fontWeight: '900',
    letterSpacing: 10,
    color: 'rgba(30,58,138,0.07)',
  },
  visaMrz: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  visaMrzText: {
    fontSize: 10,
    fontFamily: MONO,
    color: '#334155',
    letterSpacing: 0.5,
  },
  // insurance wallet
  walletStitch: {
    position: 'absolute',
    left: 14,
    right: 14,
    top: '50%',
    height: 2,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.3)',
    borderStyle: 'dashed',
  },
  walletWatermark: {
    position: 'absolute',
    bottom: 12,
    right: 12,
  },
  walletHighlight: {
    position: 'absolute',
    top: 3,
    left: 3,
    right: 3,
    height: '30%',
    borderRadius: 20,
    borderTopWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  // folder inside
  folderPocket: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '34%',
    backgroundColor: '#e2bf85',
    borderTopWidth: 1.5,
    borderColor: 'rgba(122,92,46,0.3)',
    alignItems: 'center',
    paddingTop: 8,
  },
  folderPocketText: {
    fontSize: 8,
    fontFamily: MONO,
    letterSpacing: 2,
    color: 'rgba(122,92,46,0.55)',
  },
});
