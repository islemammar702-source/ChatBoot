import { Cog, Droplets, Factory, Gauge, Tractor, Wrench, type LucideIcon } from 'lucide-react';

/** Icons for the six business sectors, keyed by category slug. */
export const sectorIcons: Record<string, LucideIcon> = {
  'agricultural-equipment': Tractor,
  'industrial-equipment': Factory,
  'hydraulic-solutions': Gauge,
  'irrigation-systems': Droplets,
  'bearings-transmissions': Cog,
  'automotive-workshop': Wrench,
};

export const iconFor = (slug: string): LucideIcon => sectorIcons[slug] ?? Cog;
