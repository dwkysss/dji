import { z } from "zod";

// Skema untuk validasi PIN 6-digit
export const pinSchema = z.object({
  pin: z
    .string()
    .length(6, "PIN harus tepat 6 digit")
    .regex(/^[0-9]+$/, "PIN hanya boleh berisi angka"),
});

export type PinSchemaInput = z.infer<typeof pinSchema>;

const detailMasalahSelectionSchema = z.union([z.array(z.string()), z.string(), z.boolean()]);

const hasSelectedDetailMasalah = (value: z.infer<typeof detailMasalahSelectionSchema> | undefined) => {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim() !== "";
  return false;
};

// Skema untuk Form Portal Input Produksi Harian (Sesuai Supabase Productions Table)
export const productionFormSchemaBase = z.object({
  operatorId: z.string().min(1, "Minimal pilih 1 operator"),
  groupId: z.string().min(1, "Grup Shift harus dipilih"),
  grupName: z.string().optional(),
  nomorMc: z.string().min(1, "Nomor MC harus diisi"),
  mesinMasihStop: z.boolean().optional(),
  designId: z.string().min(1, "Design harus dipilih"),
  designName: z.string().optional(),
  created_by_name: z.string().optional().nullable(),
  // Header Data
  statusMatching: z.string().min(1, "Status Matching harus dipilih"),
  tanggalProduksi: z.string().optional().nullable(),
  tanggalPotong: z.string().optional().nullable(),
  pick: z.string().optional().nullable(),
  noOrderBarang: z.string().optional().nullable(),
  noCustomer: z.string().optional().nullable(),
  jenisBenangDasar: z.string().optional().nullable(),
  liner: z.string().optional().nullable(),
  heavy: z.string().optional().nullable(),
  shadow: z.string().optional().nullable(),
  pinggiran: z.string().optional().nullable(),

  // Data Umum Panel (dibagikan ke semua panel dalam 1 submit)
  rpm: z
    .string()
    .optional()
    .nullable()
    .refine((val) => !val || /^\d+$/.test(val), {
      message: "RPM harus berupa angka positif jika diisi",
    }),
  potonganKe: z
    .string()
    .min(1, "Potongan ke- harus diisi")
    .regex(/^\d+$/, "Nomor potongan harus berupa angka positif"),
  panelNo: z
    .string()
    .optional()
    .nullable()
    .refine((val) => !val || /^\d+$/.test(val), {
      message: "Nomor panel harus berupa angka positif",
    }),
  isPanelGagal: z.boolean().optional(),
  course: z.string().optional().nullable(),
  pic: z.string().max(100, "Nama PIC maksimal 100 karakter").optional().nullable(),

  fotoBefore: z.string().optional().nullable(),
  fotoAfter: z.string().optional().nullable(),
  jenisLaporan: z.string().optional().nullable(),
  operatorBackup: z.string().optional().nullable(),

  // Waktu Berhenti (Global)
  totalDowntime: z.string().optional().nullable(),
  downtimeEvents: z.array(
    z.object({
      id: z.string(),
      durasiDetik: z.number(),
      kategori: z.string().optional(),
      detail: z.string().optional(),
      blok: z.string().optional(),
      pcsKe: z.string().optional(),
      dikerjakanOleh: z.string().optional(),
      problems: z.array(
        z.object({
          kategori: z.string(),
          details: z.array(z.string()),
          blok: z.string().optional(),
          meter: z.string().optional(),
        })
      ).optional(),
    })
  ).optional(),

  // Array of PCS Data untuk satu Panel
  pcsData: z.array(
    z.object({
      pcsIndex: z.string(), // Misalnya "1", "2", "3"
      jmlHasilProduksi: z.string().optional().nullable(),
      meterKain: z.string().optional().nullable(),
      isBs: z.boolean().optional(),
    })
  ).min(1, "Minimal harus ada 1 PCS"),
  idempotencyKey: z.string().optional(),
  submittedAt: z.string().optional().nullable(),
});

export const productionFormSchema = productionFormSchemaBase.superRefine((data, ctx) => {
  if (!data.tanggalPotong && (!data.panelNo || data.panelNo.trim() === "")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Nomor Panel harus diisi",
      path: ["panelNo"],
    });
  }
});

export type ProductionFormInput = z.infer<typeof productionFormSchema>;

export const pcsDataSchema = z.object({
  pcsIndex: z.string(),
  jmlHasilProduksi: z.string(),
  isBs: z.boolean().optional(),
});

export const continuousFormSchema = productionFormSchemaBase.omit({ panelNo: true, pcsData: true }).extend({
  meterAwal: z.string().optional().nullable(),
  meterAkhir: z.string().optional().nullable(),
  hasilProduksiMeter: z.string().optional().nullable(),
  targetMeter: z.string().optional().nullable(),
  jenisLaporan: z.string().optional().nullable(),
  backupOperator: z.string().optional().nullable(),
  pcsData: z.array(
    z.object({
      pcsIndex: z.string(),
      jmlHasilProduksi: z.string().optional().nullable(),
      isBs: z.boolean().optional(),
      indikatorStop: z.boolean().optional(),
      kategoriMasalah: z.array(z.string()).optional(),
      detailMasalahMap: z.record(z.string(), detailMasalahSelectionSchema).optional(),
      detailMasalah: z.string().optional().nullable(),
      spesifikMasalah: z.string().optional().nullable(),
      meterKain: z.string().optional().nullable(),
      rollNo: z.string().optional().nullable(),
      keteranganCacat: z.string().max(200, "Keterangan maksimal 200 karakter").optional().nullable(),
    })
  ),
}).superRefine((data, ctx) => {
  const hasMeter = (data.meterAkhir && data.meterAkhir.trim() !== "") ||
    (data.hasilProduksiMeter && data.hasilProduksiMeter.trim() !== "");
  const hasMasalah = data.downtimeEvents && data.downtimeEvents.length > 0;
  if (!hasMeter && !hasMasalah) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Anda harus mencatat 'Downtime' atau melaporkan 'Meteran Akhir'",
      path: ["downtimeEvents"],
    });
  }

  if (data.meterAwal && data.meterAkhir) {
    const start = parseFloat(data.meterAwal);
    const end = parseFloat(data.meterAkhir);
    if (!isNaN(start) && !isNaN(end)) {
      if (data.nomorMc === "T2A" && start < end) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Angka Finish Meter (Counter Mesin) tidak boleh lebih besar dari Target Produksi",
          path: ["meterAkhir"],
        });
      } else if (data.nomorMc !== "T2A" && start > end) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Start Meter tidak boleh lebih besar dari Finish Meter",
          path: ["meterAwal"],
        });
      }
    }
  }

  // Removed indikatorStop checks as we moved downtime tracking to global

  // Validasi totalDowntime dihapus karena perhitungan downtime sekarang diambil langsung dari durasiDetik di masing-masing downtimeEvents.
});
export type ContinuousFormInput = z.infer<typeof continuousFormSchema>;
