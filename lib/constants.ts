export interface ProblemDetailGroup {
  groupName: string;
  items: string[];
}

export const GROUPED_PROBLEM_DETAILS: Record<string, ProblemDetailGroup[]> = {
  A: [
    {
      groupName: "Benang Dasar",
      items: [
        "L1 Putus",
        "Keluar Jarum L2/L3",
        "L2/L3 Putus",
      ],
    },
    {
      groupName: "Benang Timbul",
      items: [
        "Benang Narik/Kendor",
        "Benang Timbul Putus",
        "Keluar Jarum Timbul",
      ],
    },
    {
      groupName: "Lain-lain / Tambahan",
      items: [
        "Bolong Corak",
        "Perbaikan Jalur Benang",
        "Bolong Dasar",
        "Perbaikan Meped",
        "Perbaikan Bolong-bolong",
        "Floating Keanyam",
        "Benang Nyilang",
        "Benang Kejepit/Jebol/Kusut",
        "Perbaikan/Beset Benang Dasar",
        "Benang Lolos",
        "Perb/Ganti Tricplet",
      ],
    },
  ],
  B: [
    {
      groupName: "Jarum & Jacquard",
      items: [
        "Jarum pattern patah/bengkok",
        "Ganti Jacquard",
        "Ganti jarum Compoun Nedle, pattern",
        "Ngampul",
        "Keluar Jarum",
      ],
    },
    {
      groupName: "Mekanisme & Komponen",
      items: [
        "Ganti dari scaloop ke non scaloop atau sebaliknya",
        "Ngegaris/Stopline",
        "Ganti String bar",
        "Ganti PBO",
        "Pressan As beam kendor",
        "Tensi tensioner",
      ],
    },
  ],
  C: [
    {
      groupName: "Ganti & Revisi Design",
      items: [
        "Loading design/Ganti Design",
        "Perbaikan corak/revisi",
        "Salah ganti design",
        "Error design",
      ],
    },
    {
      groupName: "Setting & Hardware",
      items: [
        "Proofing/PCB",
        "Ganti Pattern Disk",
        "Ganti pick",
      ],
    },
  ],
  D: [
    {
      groupName: "Benang Dasar (L1/L2)",
      items: [
        "Ganti benang dasar L1/L2",
        "Salah ganti benang dasar",
        "Tunggu benang dasar dari warping",
      ],
    },
    {
      groupName: "Benang Pattern (L/H/S)",
      items: [
        "Ganti benang Pattern Linner",
        "Ganti benang Pattern Heavy",
        "Ganti benang Pattern Shadow",
        "Ganti benang pattern keseluruhan (L,H,S)",
        "salah ganti benang pattern",
      ],
    },
    {
      groupName: "Suplai & Persiapan Benang",
      items: [
        "Ngelancarin",
        "Over Cone/Rewind",
        "Tunggu benang (benang belum datang)",
      ],
    },
  ],
  E: [
    {
      groupName: "Motor & Driver",
      items: [
        "Error Servo Drive",
        "Ganti motor servo",
      ],
    },
    {
      groupName: "Sensor & Kelistrikan",
      items: [
        "Sensor Benang/Laser Stop",
        "Perbaikan Eletrik lainnya",
        "Konsleting",
        "Perbaikan listrik",
      ],
    },
  ],
  F: [
    {
      groupName: "Pneumatik & Mekanik",
      items: [
        "Perbaikan cilynder Angin",
        "Ganti Bellow",
        "Perbaikan gear/Take Up Roll",
        "Ganti rantai/pertensi",
        "Ganti Black grip roll",
        "Ganti Vanbelt",
      ],
    },
    {
      groupName: "Maintenance & Servis",
      items: [
        "Ganti Oli",
        "Pelumasan/greace pada mesin",
        "Perawatan Panel Listrik",
        "Servis Overhaul",
      ],
    },
  ],
  G: [
    {
      groupName: "Operasional & Pabrik",
      items: [
        "Hari Libur",
        "Tidak ada order",
        "Tunggu info",
        "Demo",
        "Bencana/gempa/banjir",
        "Istirahat selama buka puasa",
        "Mati Listrik",
      ],
    },
    {
      groupName: "Material & Logistik",
      items: ["Tunggu Sparepart"],
    },
  ],
};

export const DEFAULT_PROBLEM_DETAILS: Record<string, string[]> = Object.fromEntries(
  Object.entries(GROUPED_PROBLEM_DETAILS).map(([cat, groups]) => [
    cat,
    groups.flatMap((g) => g.items),
  ])
);

export const REGISTERED_MACHINES = [
  "R1",
  "R2",
  "R1C",
  "R2C",
  "R3B",
  "R11",
  "R12",
  "R13",
  "R14",
  "R16",
  "T1C",
  "T2A",
];

export const PROBLEM_DETAILS = DEFAULT_PROBLEM_DETAILS;

export const PROBLEM_CATEGORIES = [
  { id: "A", name: "Kode A: Masalah dan Perbaikan Benang", short: "Benang" },
  { id: "B", name: "Kode B: Perbaikan Jarum dan Element Rajutan (Mechanical)", short: "Jarum & Mekanik" },
  { id: "C", name: "Kode C: Pengaturan dan Design stup", short: "Design & Setup" },
  { id: "D", name: "Kode D: Bahan Baku dan penggantian Benang", short: "Bahan Baku" },
  { id: "E", name: "Kode E: Masalah Kelistrikan", short: "Kelistrikan" },
  { id: "F", name: "Kode F: Perawatan Mesin,Perbaikan Mekanik (maintenance)", short: "Maintenance" },
  { id: "G", name: "Kode G: Faktor Eksternal dan Non-Teknis", short: "Eksternal & Non-Teknis" },
];

export const DEFAULT_MODULAR_DEFINITIONS: Record<string, { objects: string[]; actions: string[] }> = {
  A: {
    objects: [
      "L1",
      "L2/L3",
      "Benang Timbul",
      "Benang",
      "Corak",
      "Pinggiran",
      "Jalur Benang",
    ],
    actions: [
      "Putus",
      "Keluar Jarum",
      "Narik/Kendor",
      "Lolos",
      "Bolong",
      "Nyilang",
      "Kejepit/Jebol/Kusut",
      "Floating",
      "Meped",
    ],
  },
  B: {
    objects: [
      "Jarum Pattern",
      "Jarum Compound",
      "Jacquard",
      "String Bar",
      "PBO",
      "As Beam",
      "Tensioner",
      "Rajutan / Stopline",
    ],
    actions: [
      "Patah / Bengkok",
      "Ganti Baru",
      "Keluar Jarum",
      "Ngampul",
      "Ngegaris / Stopline",
      "Kendor",
      "Tensi",
    ],
  },
  C: {
    objects: [
      "Design",
      "Corak",
      "Pattern Disk",
      "Pick",
      "PCB / Proofing",
    ],
    actions: [
      "Ganti / Loading",
      "Revisi / Perbaikan",
      "Salah Pasang",
      "Error",
    ],
  },
  D: {
    objects: [
      "Benang Dasar (L1/L2)",
      "Pattern Linner",
      "Pattern Heavy",
      "Pattern Shadow",
      "Pattern (L,H,S)",
      "Persiapan Benang",
    ],
    actions: [
      "Ganti Benang",
      "Salah Ganti",
      "Tunggu Kiriman",
      "Ngelancarin",
      "Over Cone / Rewind",
    ],
  },
  E: {
    objects: [
      "Servo Drive / Motor",
      "Sensor Laser / Stop",
      "Kabel / Listrik",
      "Panel Kontrol",
    ],
    actions: [
      "Error / Konslet",
      "Mati Total",
      "Perbaikan",
      "Ganti Baru",
    ],
  },
  F: {
    objects: [
      "Cylinder Angin",
      "Vanbelt",
      "Rantai / Gear",
      "Take Up Roll",
      "Oli / Pelumas",
      "Overhaul",
    ],
    actions: [
      "Perbaikan",
      "Ganti Baru",
      "Kendor / Lepas",
      "Servis Berkala",
    ],
  },
  G: {
    objects: [
      "Listrik PLN",
      "Order / Kain",
      "Informasi Kantor",
      "Sparepart",
      "Buka Puasa / Istirahat",
    ],
    actions: [
      "Mati Listrik",
      "Tidak Ada Order",
      "Tunggu Info",
      "Tunggu Sparepart",
      "Libur",
    ],
  },
};
