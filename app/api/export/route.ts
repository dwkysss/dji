import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, getAuthenticatedUser } from "@/lib/supabase/server";
import { REGISTERED_MACHINES } from "@/lib/constants";
import * as xlsx from "xlsx";

export async function GET(req: NextRequest) {
  // 🔐 Hanya admin/manager yang bisa export data
  const { user, role } = await getAuthenticatedUser();
  if (!user || !["admin", "manager"].includes(role ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const monthStr = searchParams.get("month");
  const yearStr = searchParams.get("year");

  if (!monthStr || !yearStr) {
    return NextResponse.json({ error: "Missing month or year" }, { status: 400 });
  }

  const month = parseInt(monthStr);
  const year = parseInt(yearStr);

  try {
    const supabase = await createAdminClient();

    // 1. Fetch data from Supabase
    // We fetch production_headers within the month, and join with operators, groups, designs, and production_details
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = new Date(year, month, 0).toISOString().split("T")[0]; // Last day of month

    const { data, error: headersError } = await supabase
      .from("production_headers" as any)
      .select(`
        id,
        tgl,
        nomor_mc,
        course,
        rpm,
        pic,
        design_id,
        group_id,
        operators ( nama_operator ),
        groups ( nama_grup ),
        production_details (
          jml_hasil_produksi,
          kategori_masalah,
          keterangan_cacat,
          final_inspection_id,
          meter_kain
        ),
        downtime_events
      `)
      .gte("tgl", startDate)
      .lte("tgl", endDate);

    if (headersError) throw headersError;

    const headers = data as any[];

    // 2. Build the Worksheet Structure
    // Machines to include horizontally. Based on sample: 
    // R1, R2, R3, R6, R11, R12, R16, T1C, T2A, STM, S2A, R1C, S1A, R2C, R3B, R5B
    // If there are other machines in DB, we should include them too.
    const allMachines = Array.from(new Set(headers.map(h => h.nomor_mc))).filter(Boolean).sort();
    
    // Default machines from sample if DB is empty for them, or just use DB machines
    // Let's combine standard ones with what's in DB
    const standardMachines = REGISTERED_MACHINES;
    const activeMachines = REGISTERED_MACHINES;

    // Create the Workbook and Worksheet
    const wb = xlsx.utils.book_new();
    
    // Prepare an array of rows. 
    // Row 0: Machine Names
    // Row 1: Headers 1 (Desain, KETERANGAN, dll)
    // Row 2: Headers 2 (Operator, Produksi, dll)
    const wsData: any[][] = [[], [], []];

    // Build headers
    wsData[0][0] = "Tanggal";
    wsData[1][0] = "";
    wsData[2][0] = "";

    const COLS_PER_MACHINE = 26; // As observed in sample

    activeMachines.forEach((machineName, index) => {
      const startCol = 1 + (index * COLS_PER_MACHINE);
      
      // Row 0
      wsData[0][startCol] = machineName;

      // Row 1
      wsData[1][startCol] = "Desain";
      wsData[1][startCol + 1] = "KETERANGAN";
      wsData[1][startCol + 2] = "Courses";
      wsData[1][startCol + 3] = "RPM";
      wsData[1][startCol + 4] = "Eff 100%";
      wsData[1][startCol + 5] = "Team";
      wsData[1][startCol + 6] = "Nama";
      wsData[1][startCol + 7] = "Hasil";
      wsData[1][startCol + 8] = "Persentase";
      wsData[1][startCol + 9] = "Jumlah";
      wsData[1][startCol + 10] = "Persentase";
      wsData[1][startCol + 11] = "KODE TINDAKAN";
      wsData[1][startCol + 22] = "JUMLAH BEAM";

      // Row 2
      wsData[2][startCol + 6] = "Operator";
      wsData[2][startCol + 7] = "Produksi";
      wsData[2][startCol + 8] = "dari 100%";
      wsData[2][startCol + 9] = "Cacat";
      wsData[2][startCol + 10] = "Cacat";
      wsData[2][startCol + 11] = "A";
      wsData[2][startCol + 12] = "B";
      wsData[2][startCol + 13] = "C";
      wsData[2][startCol + 14] = "D";
      wsData[2][startCol + 15] = "E";
      wsData[2][startCol + 16] = "F";
      wsData[2][startCol + 17] = "G";
      wsData[2][startCol + 18] = "H";
      wsData[2][startCol + 19] = "J";
      wsData[2][startCol + 20] = "K";
      wsData[2][startCol + 21] = "L";
      wsData[2][startCol + 22] = "(KHUSUS L)";
    });

    // 3. Process Data
    // Group by Date, then by Group (A, B, C)
    const daysInMonth = new Date(year, month, 0).getDate();
    const teams = ["A", "B", "C"];

    let currentRowIdx = 3; // Starts at index 3 (4th row)
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      
      teams.forEach((team, teamIdx) => {
        const row: any[] = [];
        
        // Date is only shown on the first team row
        if (teamIdx === 0) {
          row[0] = day;
        } else {
          row[0] = "";
        }

        // Fill data for each machine
        activeMachines.forEach((machineName, mIdx) => {
          const startCol = 1 + (mIdx * COLS_PER_MACHINE);
          
          // Find matching header
          const matchedHeaders = headers.filter(h => 
            h.tgl === dateStr && 
            h.nomor_mc === machineName && 
            (h.groups?.nama_grup === team || h.group_id === team)
          );

          if (matchedHeaders.length > 0) {
            // Aggregate if multiple
            // Combine notes
            const designName = matchedHeaders.map(h => h.design_id).filter(Boolean)[0] || "";
            const courses = matchedHeaders.map(h => h.course).filter(Boolean)[0] || "";
            const rpm = matchedHeaders.map(h => h.rpm).filter(Boolean)[0] || "";
            const operator = matchedHeaders.map(h => h.operators?.nama_operator || h.pic).filter(Boolean)[0] || "";
            
            let totalHasil = 0;
            let totalCacat = 0;
            const keteranganSet = new Set<string>();

            matchedHeaders.forEach(h => {
              if (h.production_details) {
                h.production_details.forEach((d: any) => {
                  totalHasil += Number(d.jml_hasil_produksi || d.meter_kain || 0);
                  if (d.keterangan_cacat) keteranganSet.add(d.keterangan_cacat);
                  if (d.final_inspection_id === 3 || d.final_inspection_id === 2) {
                     totalCacat += 1;
                  }
                });
              }

              // Tambahan dari downtime_events
              if (h.downtime_events) {
                try {
                  const events = typeof h.downtime_events === 'string' ? JSON.parse(h.downtime_events) : h.downtime_events;
                  if (Array.isArray(events)) {
                    events.forEach((event: any) => {
                      if (event.problems && Array.isArray(event.problems)) {
                        event.problems.forEach((prob: any) => {
                          if (prob.details && Array.isArray(prob.details)) {
                            prob.details.forEach((det: string) => keteranganSet.add(det));
                          }
                        });
                      } else if (event.detail) {
                        keteranganSet.add(event.detail);
                      }
                    });
                  }
                } catch(e) {
                  // ignore
                }
              }
            });

            row[startCol] = designName;
            row[startCol + 1] = Array.from(keteranganSet).join(", ");
            row[startCol + 2] = courses;
            row[startCol + 3] = rpm;
            // Eff 100% calculation (mock or leave empty if not available in DB)
            row[startCol + 4] = ""; 
            row[startCol + 5] = team;
            row[startCol + 6] = operator;
            row[startCol + 7] = totalHasil;
            row[startCol + 8] = ""; // Persentase dari 100%
            row[startCol + 9] = totalCacat;
            row[startCol + 10] = ""; // Persentase cacat
            
            // Defect categories (leave blank as they are manual or don't map perfectly yet)
          }
        });

        wsData.push(row);
      });
    }

    const ws = xlsx.utils.aoa_to_sheet(wsData);
    xlsx.utils.book_append_sheet(wb, ws, "Rekap Bulanan");

    // Generate buffer
    const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

    // Return as downloadable file
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Disposition": `attachment; filename="Rekap_Laporan_${year}_${String(month).padStart(2, "0")}.xlsx"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });

  } catch (error: any) {
    console.error("Export error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate report" }, { status: 500 });
  }
}
