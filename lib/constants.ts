export interface ProblemDetailGroup {
  groupName: string;
  items: string[];
}

export const GROUPED_PROBLEM_DETAILS: Record<string, ProblemDetailGroup[]> = {
  A: [
    {
      groupName: "Putus & Kerusakan Benang",
      items: [
        "L1/L2/L3 Benang timbul putus",
        "Benang lolos",
        "Benang Kejepit/Jebol/Kusut",
        "Perbaikan/Beset benang Dasar",
      ],
    },
    {
      groupName: "Tegangan & Jalur Benang",
      items: [
        "Benang narik/Kendor",
        "Benang Nyilang",
        "Jalur benang",
      ],
    },
    {
      groupName: "Cacat Corak",
      items: ["Bolong corak"],
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
  "R16",
  "T1C",
  "T2A",
];

export const PROBLEM_DETAILS = DEFAULT_PROBLEM_DETAILS;
