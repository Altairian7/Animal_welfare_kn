// utils/colorUtils.ts
import Color from 'color'; // npm install color @types/color

export const addAlpha = (baseColor: string, alpha: number): string => {
  try {
    if (!baseColor || baseColor === 'transparent') return 'transparent';
    return Color(baseColor).alpha(alpha).string();
  } catch (error) {
    console.error('Color parsing error:', error);
    return baseColor; // Return original if parsing fails
  }
};

export const safeText = (value: any): string => {
  return value && typeof value === 'string' && value.trim() !== '' ? value : 'Not mentioned';
};
