import type { Category, Partner, Product } from '@/lib/types';
import { images } from './images';

/**
 * Initial catalogue (placeholder products). Also exported to supabase/seed.sql
 * with `npm run seed:sql`. Product references are placeholders to be replaced.
 */
export const seedCategories: Category[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    slug: 'agricultural-equipment',
    sort_order: 1,
    image_url: images.sectors.agricultural,
    name: { fr: 'Équipements agricoles', en: 'Agricultural Equipment', ar: 'المعدات الفلاحية' },
    description: {
      fr: 'Machines, équipements et solutions techniques agricoles.',
      en: 'Agricultural machinery, equipment and technical solutions.',
      ar: 'الآلات والمعدات والحلول التقنية الفلاحية.',
    },
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    slug: 'industrial-equipment',
    sort_order: 2,
    image_url: images.sectors.industrial,
    name: { fr: 'Équipements industriels', en: 'Industrial Equipment', ar: 'المعدات الصناعية' },
    description: {
      fr: 'Machines industrielles et pièces de rechange mécaniques.',
      en: 'Industrial machinery and mechanical spare parts.',
      ar: 'الآلات الصناعية وقطع الغيار الميكانيكية.',
    },
  },
  {
    id: '00000000-0000-4000-8000-000000000003',
    slug: 'hydraulic-solutions',
    sort_order: 3,
    image_url: images.sectors.hydraulic,
    name: { fr: 'Solutions hydrauliques', en: 'Hydraulic Solutions', ar: 'الحلول الهيدروليكية' },
    description: {
      fr: 'Pompes hydrauliques et composants hydrauliques.',
      en: 'Hydraulic pumps and hydraulic components.',
      ar: 'المضخات والمكونات الهيدروليكية.',
    },
  },
  {
    id: '00000000-0000-4000-8000-000000000004',
    slug: 'irrigation-systems',
    sort_order: 4,
    image_url: images.sectors.irrigation,
    name: { fr: "Systèmes d'irrigation", en: 'Irrigation Systems', ar: 'أنظمة الري' },
    description: {
      fr: "Équipements d'irrigation et solutions hydrauliques agricoles.",
      en: 'Irrigation equipment and agricultural water solutions.',
      ar: 'معدات الري وحلول المياه الفلاحية.',
    },
  },
  {
    id: '00000000-0000-4000-8000-000000000005',
    slug: 'bearings-transmissions',
    sort_order: 5,
    image_url: images.sectors.bearings,
    name: { fr: 'Roulements & transmissions', en: 'Bearings & Transmissions', ar: 'المحامل وأنظمة النقل' },
    description: {
      fr: 'Roulements, systèmes de transmission et composants mécaniques.',
      en: 'Bearings, transmission systems and mechanical components.',
      ar: 'المحامل وأنظمة نقل الحركة والمكونات الميكانيكية.',
    },
  },
  {
    id: '00000000-0000-4000-8000-000000000006',
    slug: 'automotive-workshop',
    sort_order: 6,
    image_url: images.sectors.automotive,
    name: { fr: 'Automobile & équipements d’atelier', en: 'Automotive & Workshop Equipment', ar: 'معدات السيارات والورشات' },
    description: {
      fr: 'Équipements électriques automobiles, outillage professionnel et fournitures d’atelier.',
      en: 'Automotive electrical equipment, professional tools and workshop supplies.',
      ar: 'المعدات الكهربائية للسيارات والأدوات المهنية ولوازم الورشات.',
    },
  },
];

const C = (slug: string) => seedCategories.find((c) => c.slug === slug)!.id;
const V: Record<string, [string, string]> = {
  'À billes / à rouleaux': ['Ball / roller', 'كروية / أسطوانية'],
  'Acier chromé': ['Chrome steel', 'فولاذ مكروم'],
  'Sur demande': ['On request', 'حسب الطلب'],
  'À engrenages': ['Gear type', 'مسننة'],
  'Selon modèle': ['Depending on model', 'حسب الطراز'],
  'Travail du sol, semis': ['Soil preparation, seeding', 'تحضير التربة، البذر'],
  '3 points': ['3-point', 'ثلاث نقاط'],
  'Goutte-à-goutte / aspersion': ['Drip / sprinkler', 'بالتنقيط / بالرش'],
  'PE / PVC': ['PE / PVC', 'PE / PVC'],
  'Arbres, joints, accouplements': ['Shafts, seals, couplings', 'محاور، حشوات، وصلات'],
  'Par référence d’origine': ['By original part number', 'حسب المرجع الأصلي'],
  Professionnel: ['Professional', 'مهني'],
  'Clés, douilles, coffrets': ['Wrenches, sockets, kits', 'مفاتيح، لقم، علب أدوات'],
  Récolte: ['Harvesting', 'الحصاد'],
  'Vérins, distributeurs, flexibles': ['Cylinders, valves, hoses', 'أسطوانات، موزعات، خراطيم'],
  'Pignons, chaînes, courroies': ['Sprockets, chains, belts', 'مسننات، سلاسل، أحزمة'],
  'Démarreurs, alternateurs': ['Starters, alternators', 'محركات بدء، مولدات'],
  '12 V / 24 V': ['12 V / 24 V', '12 V / 24 V'],
  Maintenance: ['Maintenance', 'الصيانة'],
};
const spec = (fr: string, en: string, ar: string, value: string) => ({
  label: { fr, en, ar },
  value: { fr: value, en: V[value]?.[0] ?? value, ar: V[value]?.[1] ?? value },
});

let n = 0;
const pid = () => `10000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
const created = '2026-01-01T00:00:00.000Z';

export const seedProducts: Product[] = [
  {
    id: pid(), slug: 'industrial-bearings', category_id: C('bearings-transmissions'), reference: 'REF-BRG-0001',
    featured: true, published: true, created_at: created, image_url: images.products.bearings,
    name: { fr: 'Roulements industriels', en: 'Industrial Bearings', ar: 'محامل صناعية' },
    description: {
      fr: 'Roulements à billes et à rouleaux pour machines industrielles et agricoles, conçus pour les charges élevées et un fonctionnement continu.',
      en: 'Ball and roller bearings for industrial and agricultural machinery, designed for high loads and continuous operation.',
      ar: 'محامل كروية وأسطوانية للآلات الصناعية والفلاحية، مصممة للأحمال العالية والتشغيل المتواصل.',
    },
    specs: [
      spec('Type', 'Type', 'النوع', 'À billes / à rouleaux'),
      spec('Matériau', 'Material', 'المادة', 'Acier chromé'),
      spec('Dimensions', 'Dimensions', 'الأبعاد', 'Sur demande'),
    ],
  },
  {
    id: pid(), slug: 'hydraulic-gear-pump', category_id: C('hydraulic-solutions'), reference: 'REF-HYD-0001',
    featured: true, published: true, created_at: created, image_url: images.products.pump,
    name: { fr: 'Pompes hydrauliques', en: 'Hydraulic Pumps', ar: 'مضخات هيدروليكية' },
    description: {
      fr: 'Pompes hydrauliques à engrenages pour tracteurs, engins et circuits industriels. Débit et pression adaptés à chaque application.',
      en: 'Gear-type hydraulic pumps for tractors, machinery and industrial circuits. Flow and pressure matched to each application.',
      ar: 'مضخات هيدروليكية مسننة للجرارات والآليات والدوائر الصناعية، بتدفق وضغط ملائمين لكل استخدام.',
    },
    specs: [
      spec('Technologie', 'Technology', 'التقنية', 'À engrenages'),
      spec('Pression', 'Pressure', 'الضغط', 'Selon modèle'),
      spec('Débit', 'Flow rate', 'التدفق', 'Selon modèle'),
    ],
  },
  {
    id: pid(), slug: 'agricultural-equipment-range', category_id: C('agricultural-equipment'), reference: 'REF-AGR-0001',
    featured: true, published: true, created_at: created, image_url: images.products.tractor,
    name: { fr: 'Équipements agricoles', en: 'Agricultural Equipment', ar: 'معدات فلاحية' },
    description: {
      fr: 'Outils et équipements attelés pour le travail du sol, le semis et l’entretien des cultures.',
      en: 'Mounted tools and equipment for soil preparation, seeding and crop maintenance.',
      ar: 'أدوات ومعدات مركبة لتحضير التربة والبذر والعناية بالمحاصيل.',
    },
    specs: [
      spec('Application', 'Application', 'الاستخدام', 'Travail du sol, semis'),
      spec('Attelage', 'Hitch', 'الربط', '3 points'),
      spec('Compatibilité', 'Compatibility', 'التوافق', 'Sur demande'),
    ],
  },
  {
    id: pid(), slug: 'irrigation-components', category_id: C('irrigation-systems'), reference: 'REF-IRR-0001',
    featured: true, published: true, created_at: created, image_url: images.products.irrigation,
    name: { fr: "Composants d'irrigation", en: 'Irrigation Components', ar: 'مكونات الري' },
    description: {
      fr: 'Raccords, vannes, filtres et goutteurs pour réseaux d’irrigation goutte-à-goutte et par aspersion.',
      en: 'Fittings, valves, filters and drippers for drip and sprinkler irrigation networks.',
      ar: 'وصلات وصمامات ومرشحات ونقاطات لشبكات الري بالتنقيط والرش.',
    },
    specs: [
      spec('Système', 'System', 'النظام', 'Goutte-à-goutte / aspersion'),
      spec('Diamètres', 'Diameters', 'الأقطار', 'Sur demande'),
      spec('Matériau', 'Material', 'المادة', 'PE / PVC'),
    ],
  },
  {
    id: pid(), slug: 'mechanical-spare-parts', category_id: C('industrial-equipment'), reference: 'REF-IND-0001',
    featured: true, published: true, created_at: created, image_url: images.products.spares,
    name: { fr: 'Pièces de rechange mécaniques', en: 'Mechanical Spare Parts', ar: 'قطع غيار ميكانيكية' },
    description: {
      fr: 'Pièces de rechange pour machines industrielles et agricoles : arbres, joints, accouplements et éléments d’usure.',
      en: 'Spare parts for industrial and agricultural machinery: shafts, seals, couplings and wear parts.',
      ar: 'قطع غيار للآلات الصناعية والفلاحية: محاور، حشوات، وصلات وقطع استهلاكية.',
    },
    specs: [
      spec('Gamme', 'Range', 'التشكيلة', 'Arbres, joints, accouplements'),
      spec('Identification', 'Identification', 'التعريف', 'Par référence d’origine'),
      spec('Disponibilité', 'Availability', 'التوفر', 'Sur demande'),
    ],
  },
  {
    id: pid(), slug: 'professional-workshop-tools', category_id: C('automotive-workshop'), reference: 'REF-WSH-0001',
    featured: true, published: true, created_at: created, image_url: images.products.tools,
    name: { fr: "Outillage professionnel d'atelier", en: 'Professional Workshop Tools', ar: 'أدوات ورشات مهنية' },
    description: {
      fr: 'Outillage à main et équipements d’atelier pour la maintenance mécanique et automobile.',
      en: 'Hand tools and workshop equipment for mechanical and automotive maintenance.',
      ar: 'أدوات يدوية ومعدات ورشات للصيانة الميكانيكية وصيانة السيارات.',
    },
    specs: [
      spec('Usage', 'Use', 'الاستعمال', 'Professionnel'),
      spec('Gamme', 'Range', 'التشكيلة', 'Clés, douilles, coffrets'),
      spec('Normes', 'Standards', 'المعايير', 'Sur demande'),
    ],
  },
  {
    id: pid(), slug: 'harvester-spare-parts', category_id: C('agricultural-equipment'), reference: 'REF-AGR-0002',
    featured: false, published: true, created_at: created, image_url: images.products.harvester,
    name: { fr: 'Pièces pour moissonneuses', en: 'Harvester Parts', ar: 'قطع غيار الحصادات' },
    description: {
      fr: 'Composants et pièces d’usure pour moissonneuses-batteuses et matériel de récolte.',
      en: 'Components and wear parts for combine harvesters and harvesting equipment.',
      ar: 'مكونات وقطع استهلاكية للحصادات الدراسة ومعدات الحصاد.',
    },
    specs: [spec('Application', 'Application', 'الاستخدام', 'Récolte'), spec('Compatibilité', 'Compatibility', 'التوافق', 'Sur demande')],
  },
  {
    id: pid(), slug: 'hydraulic-cylinders-valves', category_id: C('hydraulic-solutions'), reference: 'REF-HYD-0002',
    featured: false, published: true, created_at: created, image_url: images.products.valves,
    name: { fr: 'Vérins & distributeurs hydrauliques', en: 'Hydraulic Cylinders & Valves', ar: 'أسطوانات وموزعات هيدروليكية' },
    description: {
      fr: 'Vérins, distributeurs et flexibles pour circuits hydrauliques mobiles et industriels.',
      en: 'Cylinders, directional valves and hoses for mobile and industrial hydraulic circuits.',
      ar: 'أسطوانات وموزعات وخراطيم للدوائر الهيدروليكية المتنقلة والصناعية.',
    },
    specs: [spec('Gamme', 'Range', 'التشكيلة', 'Vérins, distributeurs, flexibles'), spec('Pression', 'Pressure', 'الضغط', 'Selon modèle')],
  },
  {
    id: pid(), slug: 'sprinkler-systems', category_id: C('irrigation-systems'), reference: 'REF-IRR-0002',
    featured: false, published: true, created_at: created, image_url: images.products.sprinkler,
    name: { fr: 'Asperseurs & arroseurs', en: 'Sprinklers', ar: 'رشاشات الري' },
    description: {
      fr: 'Asperseurs et arroseurs pour l’irrigation de grandes cultures et d’espaces agricoles.',
      en: 'Sprinklers for field crops and large agricultural areas.',
      ar: 'رشاشات لري المحاصيل الكبرى والمساحات الفلاحية.',
    },
    specs: [spec('Portée', 'Range', 'المدى', 'Selon modèle'), spec('Raccordement', 'Connection', 'التوصيل', 'Sur demande')],
  },
  {
    id: pid(), slug: 'gears-transmission-components', category_id: C('bearings-transmissions'), reference: 'REF-BRG-0002',
    featured: false, published: true, created_at: created, image_url: images.products.gears,
    name: { fr: 'Engrenages & transmissions', en: 'Gears & Transmission Parts', ar: 'تروس وقطع نقل الحركة' },
    description: {
      fr: 'Pignons, chaînes, courroies et poulies pour la transmission de puissance.',
      en: 'Sprockets, chains, belts and pulleys for power transmission.',
      ar: 'مسننات وسلاسل وأحزمة وبكرات لنقل القدرة.',
    },
    specs: [spec('Gamme', 'Range', 'التشكيلة', 'Pignons, chaînes, courroies'), spec('Dimensions', 'Dimensions', 'الأبعاد', 'Sur demande')],
  },
  {
    id: pid(), slug: 'automotive-electrical-equipment', category_id: C('automotive-workshop'), reference: 'REF-WSH-0002',
    featured: false, published: true, created_at: created, image_url: images.products.engine,
    name: { fr: 'Équipement électrique automobile', en: 'Automotive Electrical Equipment', ar: 'معدات كهربائية للسيارات' },
    description: {
      fr: 'Démarreurs, alternateurs et composants électriques pour véhicules et engins.',
      en: 'Starters, alternators and electrical components for vehicles and machinery.',
      ar: 'محركات بدء التشغيل والمولدات والمكونات الكهربائية للمركبات والآليات.',
    },
    specs: [spec('Gamme', 'Range', 'التشكيلة', 'Démarreurs, alternateurs'), spec('Tension', 'Voltage', 'الجهد', '12 V / 24 V')],
  },
  {
    id: pid(), slug: 'industrial-maintenance-equipment', category_id: C('industrial-equipment'), reference: 'REF-IND-0002',
    featured: false, published: true, created_at: created, image_url: images.products.workshop,
    name: { fr: 'Équipements de maintenance industrielle', en: 'Industrial Maintenance Equipment', ar: 'معدات الصيانة الصناعية' },
    description: {
      fr: 'Équipements et consommables pour la maintenance préventive et corrective des sites industriels.',
      en: 'Equipment and consumables for preventive and corrective maintenance of industrial sites.',
      ar: 'معدات ومستهلكات للصيانة الوقائية والتصحيحية للمواقع الصناعية.',
    },
    specs: [spec('Usage', 'Use', 'الاستعمال', 'Maintenance'), spec('Disponibilité', 'Availability', 'التوفر', 'Sur demande')],
  },
];

/** Placeholder partner slots — replace with real partner logos from the admin. */
export const seedPartners: Partner[] = Array.from({ length: 6 }, (_, i) => ({
  id: `20000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
  name: `Partner ${String(i + 1).padStart(2, '0')}`,
  logo_url: null,
  website: null,
  sort_order: i + 1,
  published: true,
}));
