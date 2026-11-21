import { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import type { PetSpecies } from '@/types/api';
import type { PetAnimationState } from './pet-animation';

/**
 * Vector art for the fox pet (viewBox 0 0 200 200). Split into layers so the renderer can move
 * the head, tail, eyes and mouth independently. Accessories are drawn per assetKey.
 */
export interface Palette {
  fur: string;
  furDark: string;
  belly: string;
  earInner: string;
  nose: string;
  eye: string;
  blush: string;
}

export const PALETTES: Record<PetSpecies, Palette> = {
  FOX: {
    fur: '#FB8B3C',
    furDark: '#E2661C',
    belly: '#FFF6EC',
    earInner: '#FFD2B0',
    nose: '#3B2A20',
    eye: '#2A211C',
    blush: '#FF8A8A',
  },
  SNOW_FOX: {
    fur: '#EEF2F7',
    furDark: '#C7D0DC',
    belly: '#FFFFFF',
    earInner: '#F9C9DD',
    nose: '#475569',
    eye: '#334155',
    blush: '#F9A8C9',
  },
  NIGHT_FOX: {
    fur: '#7C6BD6',
    furDark: '#5546B0',
    belly: '#EFEAFF',
    earInner: '#C9BDFB',
    nose: '#1E1B4B',
    eye: '#1E1B4B',
    blush: '#F0A6CA',
  },
};

export type EyeStyle = 'open' | 'happy' | 'closed' | 'sad';
export type MouthStyle = 'smile' | 'open' | 'chew' | 'small' | 'frown';

export interface Expression {
  eyes: EyeStyle;
  mouth: MouthStyle;
  blush: boolean;
}

export function expressionFor(state: PetAnimationState): Expression {
  switch (state) {
    case 'HAPPY':
    case 'CELEBRATE':
    case 'LEVEL_UP':
      return { eyes: 'happy', mouth: 'open', blush: true };
    case 'UNLOCK':
      return { eyes: 'open', mouth: 'open', blush: true };
    case 'EATING':
      return { eyes: 'happy', mouth: 'chew', blush: true };
    case 'CARE':
      return { eyes: 'closed', mouth: 'smile', blush: true };
    case 'SLEEPING':
      return { eyes: 'closed', mouth: 'small', blush: false };
    case 'SAD':
      return { eyes: 'sad', mouth: 'frown', blush: false };
    case 'IDLE':
      return { eyes: 'open', mouth: 'smile', blush: false };
  }
}

export function Tail({ p }: { p: Palette }) {
  return (
    <G>
      <Path
        d="M126 152 C 160 154, 186 130, 180 98 C 176 80, 158 76, 150 90 C 162 104, 158 128, 126 138 Z"
        fill={p.fur}
      />
      <Path d="M180 98 C 176 80, 158 76, 150 90 C 158 95, 170 97, 180 98 Z" fill={p.belly} />
    </G>
  );
}

export function Body({ p }: { p: Palette }) {
  return (
    <G>
      <Ellipse cx={100} cy={142} rx={40} ry={35} fill={p.fur} />
      <Ellipse cx={100} cy={150} rx={24} ry={24} fill={p.belly} />
      <Ellipse cx={82} cy={175} rx={12} ry={7} fill={p.furDark} />
      <Ellipse cx={118} cy={175} rx={12} ry={7} fill={p.furDark} />
    </G>
  );
}

export function Head({ p, blush }: { p: Palette; blush: boolean }) {
  return (
    <G>
      {/* ears */}
      <Path
        d="M64 72 L58 26 L94 54 Z"
        fill={p.fur}
        stroke={p.fur}
        strokeWidth={8}
        strokeLinejoin="round"
      />
      <Path d="M68 62 L65 38 L84 53 Z" fill={p.earInner} />
      <Path
        d="M136 72 L142 26 L106 54 Z"
        fill={p.fur}
        stroke={p.fur}
        strokeWidth={8}
        strokeLinejoin="round"
      />
      <Path d="M132 62 L135 38 L116 53 Z" fill={p.earInner} />
      {/* head + muzzle */}
      <Ellipse cx={100} cy={86} rx={47} ry={40} fill={p.fur} />
      <Path
        d="M62 92 Q 70 120 100 122 Q 130 120 138 92 Q 120 104 100 104 Q 80 104 62 92 Z"
        fill={p.belly}
      />
      <Ellipse cx={100} cy={97} rx={6.5} ry={4.8} fill={p.nose} />
      {blush ? (
        <G opacity={0.55}>
          <Ellipse cx={70} cy={99} rx={8} ry={4.5} fill={p.blush} />
          <Ellipse cx={130} cy={99} rx={8} ry={4.5} fill={p.blush} />
        </G>
      ) : null}
    </G>
  );
}

export function Eyes({ p, style }: { p: Palette; style: EyeStyle }) {
  const stroke = { stroke: p.eye, strokeWidth: 3.8, strokeLinecap: 'round' as const, fill: 'none' };
  switch (style) {
    case 'open':
      return (
        <G>
          <Ellipse cx={81} cy={82} rx={6.2} ry={7.6} fill={p.eye} />
          <Ellipse cx={119} cy={82} rx={6.2} ry={7.6} fill={p.eye} />
          <Circle cx={83.4} cy={78.8} r={2.2} fill="#FFFFFF" />
          <Circle cx={121.4} cy={78.8} r={2.2} fill="#FFFFFF" />
        </G>
      );
    case 'happy':
      return (
        <G>
          <Path d="M74 85 Q 81 75 88 85" {...stroke} />
          <Path d="M112 85 Q 119 75 126 85" {...stroke} />
        </G>
      );
    case 'closed':
      return (
        <G>
          <Path d="M74 82 Q 81 89 88 82" {...stroke} />
          <Path d="M112 82 Q 119 89 126 82" {...stroke} />
        </G>
      );
    case 'sad':
      return (
        <G>
          <Ellipse cx={81} cy={86} rx={5.5} ry={6.5} fill={p.eye} />
          <Ellipse cx={119} cy={86} rx={5.5} ry={6.5} fill={p.eye} />
          <Circle cx={83} cy={83.5} r={1.8} fill="#FFFFFF" />
          <Circle cx={121} cy={83.5} r={1.8} fill="#FFFFFF" />
          <Path d="M72 74 L88 77" {...stroke} strokeWidth={3} />
          <Path d="M128 74 L112 77" {...stroke} strokeWidth={3} />
        </G>
      );
  }
}

export function Mouth({ p, style }: { p: Palette; style: MouthStyle }) {
  const stroke = {
    stroke: p.nose,
    strokeWidth: 2.8,
    strokeLinecap: 'round' as const,
    fill: 'none',
  };
  switch (style) {
    case 'smile':
      return <Path d="M91 103 Q 100 110 109 103" {...stroke} />;
    case 'open':
      return (
        <G>
          <Path d="M89 102 Q 100 120 111 102 Z" fill="#7A2E2E" />
          <Path d="M94 112 Q 100 118 106 112 Q 100 108 94 112 Z" fill="#F87171" />
        </G>
      );
    case 'chew':
      return <Ellipse cx={100} cy={107} rx={5} ry={5.5} fill="#7A2E2E" />;
    case 'small':
      return <Path d="M96 105 Q 100 107 104 105" {...stroke} />;
    case 'frown':
      return <Path d="M93 108 Q 100 102 107 108" {...stroke} />;
  }
}

// ─── Accessories (keyed by PetAccessory.assetKey) ───

export function Background({ assetKey }: { assetKey: string }) {
  if (assetKey !== 'bg_steppe') return null;
  return (
    <G>
      <Rect x={0} y={0} width={200} height={200} rx={28} fill="#E0F2FE" />
      <Circle cx={158} cy={40} r={16} fill="#FDE68A" />
      <Path d="M0 158 Q 50 128 100 148 Q 150 168 200 138 L200 200 L0 200 Z" fill="#BBF7D0" />
      <Path d="M0 176 Q 60 160 120 176 Q 160 186 200 172 L200 200 L0 200 Z" fill="#86EFAC" />
      {/* a tiny ger on the horizon */}
      <Path d="M22 150 L22 138 Q 34 124 46 138 L46 150 Z" fill="#FFFFFF" />
      <Rect x={31} y={142} width={6} height={8} fill="#F97316" />
    </G>
  );
}

export function BodyAccessory({ assetKey }: { assetKey: string }) {
  if (assetKey !== 'body_deel') return null;
  return (
    <G>
      <Path
        d="M62 142 Q 60 110 100 108 Q 140 110 138 142 Q 138 176 100 176 Q 62 176 62 142 Z"
        fill="#2563EB"
      />
      <Path d="M100 108 L86 176" stroke="#FBBF24" strokeWidth={4} />
      <Rect x={63} y={146} width={74} height={8} fill="#F59E0B" />
    </G>
  );
}

export function NeckAccessory({ assetKey }: { assetKey: string }) {
  switch (assetKey) {
    case 'neck_red_scarf':
      return (
        <G>
          <Path d="M68 116 Q 100 132 132 116 L132 127 Q 100 143 68 127 Z" fill="#EF4444" />
          <Path d="M116 126 L126 154 L112 152 Z" fill="#DC2626" />
        </G>
      );
    case 'neck_flame_badge':
      return (
        <G>
          <Path d="M72 118 Q 100 130 128 118" stroke="#1E293B" strokeWidth={3} fill="none" />
          <Circle cx={100} cy={131} r={10} fill="#F59E0B" stroke="#FFFFFF" strokeWidth={2} />
          <Path d="M100 124 Q 106 130 103 136 Q 100 139 97 136 Q 94 131 100 124 Z" fill="#EF4444" />
        </G>
      );
    default:
      return null;
  }
}

export function FaceAccessory({ assetKey }: { assetKey: string }) {
  if (assetKey !== 'face_sunglasses') return null;
  return (
    <G>
      <Rect x={68} y={73} width={26} height={17} rx={7} fill="#1E293B" />
      <Rect x={106} y={73} width={26} height={17} rx={7} fill="#1E293B" />
      <Path d="M94 79 L106 79" stroke="#1E293B" strokeWidth={3} />
      <Path d="M72 77 L80 77" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" />
      <Path d="M110 77 L118 77" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" />
    </G>
  );
}

export function HeadAccessory({ assetKey }: { assetKey: string }) {
  switch (assetKey) {
    case 'head_party_hat':
      return (
        <G>
          <Path d="M100 12 L84 50 L116 50 Z" fill="#8B5CF6" />
          <Path d="M92 32 L108 32" stroke="#FDE68A" strokeWidth={3} />
          <Path d="M88 42 L112 42" stroke="#FDE68A" strokeWidth={3} />
          <Circle cx={100} cy={12} r={5} fill="#F59E0B" />
        </G>
      );
    case 'head_golden_crown':
      return (
        <G>
          <Path d="M76 52 L80 28 L91 41 L100 24 L109 41 L120 28 L124 52 Z" fill="#FBBF24" />
          <Rect x={76} y={48} width={48} height={6} rx={2} fill="#F59E0B" />
          <Circle cx={100} cy={40} r={3} fill="#EF4444" />
          <Circle cx={86} cy={44} r={2.4} fill="#22C55E" />
          <Circle cx={114} cy={44} r={2.4} fill="#3B82F6" />
        </G>
      );
    default:
      return null;
  }
}

/** Emoji shorthand for lists and chips (the pet itself always renders the vector art). */
export const ACCESSORY_EMOJI: Record<string, string> = {
  neck_red_scarf: '🧣',
  head_party_hat: '🎉',
  face_sunglasses: '🕶️',
  body_deel: '👘',
  bg_steppe: '🏞️',
  neck_flame_badge: '🔥',
  head_golden_crown: '👑',
};
