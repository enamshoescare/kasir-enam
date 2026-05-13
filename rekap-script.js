const ROLE = sessionStorage.getItem('role');

function checkAuth() { 
    if (!ROLE) window.location.href = 'login.html'; 
}

function logout() { 
    sessionStorage.clear(); 
    window.location.href = 'login.html'; 
}

function muatData() {
    checkAuth();
    const db = JSON.parse(localStorage.getItem('cuciSepatuDB')) || [];
    const tbody = document.getElementById('listRiwayat');
    const noData = document.getElementById('noData');
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const searchDate = document.getElementById('dateInput').value; 
    
    if (ROLE === 'staff') {
        const resBtn = document.getElementById('btnRestore');
        const delBtn = document.getElementById('btnDeleteAll');
        if(resBtn) resBtn.style.display = 'none';
        if(delBtn) delBtn.style.display = 'none';
    }

    let omzetTotal = 0, sepatuTotal = 0, cashTotal = 0, transferTotal = 0;
    tbody.innerHTML = "";

    const filteredData = db.filter(t => {
        const matchNama = t.nama.toLowerCase().includes(searchTerm);
        let matchDate = true;
        if (searchDate) {
            const parts = t.tgl.split(',')[0].trim().split('/');
            if(parts.length === 3) {
                const dateFromDB = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                matchDate = (dateFromDB === searchDate);
            }
        }
        return matchNama && matchDate;
    });

    if (filteredData.length === 0) {
        noData.style.display = "block";
        updateStatsDisplay(0, 0, 0, 0);
        return;
    } else { 
        noData.style.display = "none"; 
    }

    filteredData.slice().reverse().forEach(t => {
        const total = Number(t.total) || 0;
        const metode = t.metode || '-';
        const status = t.status || 'Belum Diambil';
        const statusBayar = t.statusBayar || 'Belum Lunas';

        if (statusBayar === 'Lunas') {
            omzetTotal += total;
            if (metode === 'Transfer') transferTotal += total;
            else if (metode === 'Tunai') cashTotal += total;
        }
        sepatuTotal += (Number(t.sepatu) || 0);

        let detailTampil = (t.layanan || "").replace(/, $/, "").trim();
        
        // --- LOGIKA WARNA STATUS BARU ---
        const statusClass = status === 'Sudah Diambil' ? 'status-done' : 
                            (status === 'Siap Diambil' ? 'status-siap' : 'status-pending');
        
        const payClass = statusBayar === 'Lunas' ? 'pay-lunas' : 'pay-belum';

        tbody.innerHTML += `
            <tr>
                <td>${t.tgl.split(',')[0]}</td>
                    <td class="col-nama">
                     <span class="nama-klik" onclick="tampilkanDetailPelanggan(${t.id})">
                      ${t.nama}
             </span>
            </td>   
                <td><div style="max-width: 140px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${detailTampil || '-'}</div></td>
                <td><span style="font-size: 10px; background: #fff; border: 1px solid #ddd; padding: 3px 6px; border-radius: 4px;">${metode}</span></td>
                <td><button class="badge-status ${payClass}" onclick="toggleBayar(${t.id})">${statusBayar}</button></td>
                <td><button class="badge-status ${statusClass}" onclick="toggleStatus(${t.id})">${status}</button></td>
                <td>${total.toLocaleString('id-ID')}</td>
                <td>
                    <div class="btn-action-group">
                      <button class="btn-kecil btn-print" onclick="cetakNota(${t.id})" title="Cetak Nota">
    <span class="material-symbols-outlined" style="font-size: 18px;">print</span>
</button>
                       ${ROLE === 'admin' ? `
    <button class="btn-kecil btn-hapus-item" onclick="hapusData(${t.id})" title="Hapus Data">
        <span class="material-symbols-outlined">delete</span>
    </button>` 
: ''}
                    </div>
                </td>
            </tr>
        `;
    });
    updateStatsDisplay(sepatuTotal, omzetTotal, cashTotal, transferTotal);
}

// --- FITUR: DETAIL PELANGGAN (MODAL) ---
function tampilkanDetailPelanggan(id) {
    const db = JSON.parse(localStorage.getItem('cuciSepatuDB')) || [];
    const data = db.find(x => x.id === id);
    
    if (data) {
        // Mengisi data ke modal detail (Pastikan elemen ID ini ada di rekapan.html)
        const detNama = document.getElementById('detNama');
        const detWA = document.getElementById('detWA');
        const detInv = document.getElementById('detInv');
        const detLayanan = document.getElementById('detLayanan');

        if(detNama) detNama.innerText = data.nama;
        if(detWA) detWA.innerText = data.wa || '-';
        if(detInv) detInv.innerText = data.inv || "INV-" + data.id;
        if(detLayanan) detLayanan.innerText = data.layanan;
        
        const modal = document.getElementById('modalDetail');
        if(modal) modal.style.display = 'flex';
    }
}

function tutupModalDetail() {
    const modal = document.getElementById('modalDetail');
    if(modal) modal.style.display = 'none';
}

// --- FITUR BARU: TOGGLE STATUS 3 TAHAP & WA ---
function toggleStatus(id) {
    let db = JSON.parse(localStorage.getItem('cuciSepatuDB')) || [];
    const index = db.findIndex(x => x.id === id);
    
    if (index !== -1) {
        const currentStatus = db[index].status || 'Belum Diambil';
        let nextStatus;

        if (currentStatus === 'Belum Diambil') {
            nextStatus = 'Siap Diambil';
            kirimWA_Siap(db[index]); // Panggil Notifikasi WA
        } else if (currentStatus === 'Siap Diambil') {
            nextStatus = 'Sudah Diambil';
        } else {
            nextStatus = 'Belum Diambil';
        }

        db[index].status = nextStatus;
        localStorage.setItem('cuciSepatuDB', JSON.stringify(db));
        muatData();
    }
}

function kirimWA_Siap(data) {
    const konfirmasi = confirm(`Kirim notifikasi WA ke ${data.nama} bahwa sepatu siap diambil?`);
    
    if (konfirmasi) {
        let waAPI = data.wa;
        if (waAPI.startsWith('0')) {
            waAPI = '62' + waAPI.slice(1);
        } else if (!waAPI.startsWith('62')) {
            waAPI = '62' + waAPI;
        }

        const pesan = `*ENAM SHOES CARE*\n` +
                      `--------------------------------\n` +
                      `Halo Kak *${data.nama}*,\n\n` +
                      `Sepatu Kakak dengan nomor nota *${data.inv}* telah selesai kami kerjakan dan *SIAP DIAMBIL*. 👟✨\n\n` +
                      `Layanan: ${data.layanan}\n` +
                      `--------------------------------\n` +
                      `Terima kasih, sampai jumpa di toko!`;

        window.open(`https://api.whatsapp.com/send?phone=${waAPI}&text=${encodeURIComponent(pesan)}`, '_blank');
    }
}

// --- FITUR PEMBAYARAN TETAP ADA ---
function toggleBayar(id) {
    let db = JSON.parse(localStorage.getItem('cuciSepatuDB')) || [];
    const index = db.findIndex(x => x.id === id);
    if (index === -1) return;
    const data = db[index];
    if (data.statusBayar === 'Belum Lunas') {
        document.getElementById('mId').value = id;
        document.getElementById('mSub').value = data.sub || data.total;
        document.getElementById('mDiskon').value = data.diskon || 0;
        document.getElementById('mUangBayar').value = data.total || 0;
        hitungModal();
        document.getElementById('modalBayar').style.display = 'flex';
    } else {
        if(confirm(`Ubah status kembali menjadi Belum Lunas?`)) {
            db[index].statusBayar = 'Belum Lunas';
            db[index].bayar = 0;
            db[index].kembali = 0;
            localStorage.setItem('cuciSepatuDB', JSON.stringify(db));
            muatData();
        }
    }
}

function hitungModal() {
    const sub = Number(document.getElementById('mSub').value) || 0;
    const diskon = Number(document.getElementById('mDiskon').value) || 0;
    const bayar = Number(document.getElementById('mUangBayar').value) || 0;
    const totalAkhir = sub - diskon;
    const kembalian = bayar - totalAkhir;
    document.getElementById('mTotal').value = totalAkhir;
    document.getElementById('mKembali').value = kembalian;
    const labelKembali = document.getElementById('labelMKembali');
    labelKembali.innerText = kembalian < 0 ? "Sisa Tagihan (Rp):" : "Kembalian (Rp):";
}

function prosesLunas() {
    const id = parseInt(document.getElementById('mId').value);
    let db = JSON.parse(localStorage.getItem('cuciSepatuDB')) || [];
    const index = db.findIndex(x => x.id === id);
    
    if (index !== -1) {
        const metodeBaru = document.getElementById('mMetode').value; 
        db[index].metode = metodeBaru;
        db[index].diskon = Number(document.getElementById('mDiskon').value);
        db[index].total = Number(document.getElementById('mTotal').value);
        db[index].bayar = Number(document.getElementById('mUangBayar').value);
        db[index].kembali = Number(document.getElementById('mKembali').value);
        db[index].statusBayar = 'Lunas';
        
        localStorage.setItem('cuciSepatuDB', JSON.stringify(db));
        tutupModal(); 
        muatData();
    }
}

function tutupModal() { 
    document.getElementById('modalBayar').style.display = 'none'; 
}

function cetakNota(id) {
    const db = JSON.parse(localStorage.getItem('cuciSepatuDB')) || [];
    const t = db.find(x => x.id === id);
    if (!t) return;

    document.getElementById('notaInv').innerText = t.inv || 'INV-' + t.id;
    document.getElementById('notaTgl').innerText = "Tgl: " + t.tgl;
    document.getElementById('notaNama').innerText = "Nama: " + t.nama;
    document.getElementById('notaWA').innerText = "WA : " + (t.wa || '-');
    document.getElementById('notaMetode').innerText = "Metode: " + (t.metode || 'Tunai');
    
    const areaStatus = document.getElementById('notaStatus');
    areaStatus.innerHTML = `<div class="line"></div><div class="text-bold">STATUS: ${t.statusBayar.toUpperCase()} </div><div class="line"></div>`;
    
    document.getElementById('notaDetail').innerHTML = t.detailHtml || '-';
    const sub = Number(t.sub) || Number(t.total);
    const disk = Number(t.diskon) || 0;
    const tot = Number(t.total) || 0;
    const bay = Number(t.bayar) || 0;
    
    document.getElementById('nSub').innerText = "Rp " + sub.toLocaleString('id-ID');
    document.getElementById('nDisk').innerText = "-Rp " + disk.toLocaleString('id-ID');
    document.getElementById('nTotal').innerText = "Rp " + tot.toLocaleString('id-ID');
    document.getElementById('nBayar').innerText = "Rp " + bay.toLocaleString('id-ID');

    const labelKembali = document.getElementById('labelNKembali');
    const fieldKembali = document.getElementById('nKembali');

    if (t.statusBayar === 'Lunas') {
        labelKembali.innerText = "KEMBALI:";
        fieldKembali.innerText = "Rp " + Math.max(0, bay - tot).toLocaleString('id-ID');
    } else {
        labelKembali.innerText = "SISA TAGIHAN:";
        fieldKembali.innerText = "Rp " + Math.max(0, tot - bay).toLocaleString('id-ID');
    }

    setTimeout(() => { window.print(); }, 300);
}

function updateStatsDisplay(sepatu, omzet, cash, transfer) {
    document.getElementById('totalSepatu').innerText = sepatu;
    document.getElementById('totalOmzet').innerText = "Rp " + omzet.toLocaleString('id-ID');
    document.getElementById('totalCash').innerText = "Rp " + cash.toLocaleString('id-ID');
    document.getElementById('totalTransfer').innerText = "Rp " + transfer.toLocaleString('id-ID');
}

function resetFilter() { 
    document.getElementById('searchInput').value = ""; 
    document.getElementById('dateInput').value = ""; 
    muatData(); 
}

function downloadExcel() {
    const db = JSON.parse(localStorage.getItem('cuciSepatuDB')) || [];
    if (db.length === 0) return alert("Tidak ada data untuk didownload");

    let totalCash = 0;
    let totalTransfer = 0;
    let totalSepatu = 0;

    // 1. Susun Data Transaksi Utama
    const rows = db.map(t => {
        const total = Number(t.total) || 0;
        const sepatu = Number(t.sepatu) || 1;
        const metode = t.metode || '-';
        const isLunas = t.statusBayar === 'Lunas';

        // Hitung akumulasi hanya untuk yang Lunas
        if (isLunas) {
            if (metode === 'Tunai' || metode === 'Cash') totalCash += total;
            if (metode === 'Transfer') totalTransfer += total;
        }
        totalSepatu += sepatu;

        return {
            "Tanggal": t.tgl,
            "Nama Pelanggan": t.nama,
            "Layanan": t.layanan,
            "Metode": metode,
            "Status": t.statusBayar,
            "Jumlah Sepatu": sepatu,
            "Subtotal": t.sub,
            "Diskon": t.diskon,
            "Total Bayar": total
        };
    });

    // 2. Tambahkan Baris Kosong Sebagai Pemisah
    rows.push({}); 
    rows.push({}); 

    // 3. Tambahkan Bagian Ringkasan Pendapatan
    rows.push({ "Layanan": "RINGKASAN PENDAPATAN (LUNAS)" });
    rows.push({ "Layanan": "Total Cash", "Total Bayar": totalCash });
    rows.push({ "Layanan": "Total Transfer", "Total Bayar": totalTransfer });
    rows.push({ "Layanan": "Total Sepatu", "Total Bayar": totalSepatu });
    rows.push({ "Layanan": "TOTAL KESELURUHAN", "Total Bayar": totalCash + totalTransfer });

    // 4. Proses Pembuatan File
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rekapan Enam Shoes");

    // 5. Download File dengan Nama yang Rapi
    const tglFile = new Date().toLocaleDateString('id-ID').replace(/\//g, '-');
    XLSX.writeFile(workbook, `Rekap_Enam_${tglFile}.xlsx`);
}

function hapusData(id) {
    if (ROLE !== 'admin') return;
    if(confirm("Hapus data ini?")) {
        let db = JSON.parse(localStorage.getItem('cuciSepatuDB')) || [];
        db = db.filter(x => x.id !== id);
        localStorage.setItem('cuciSepatuDB', JSON.stringify(db)); muatData();
    }
}

function hapusSemuaData() {
    if (ROLE !== 'admin') return;
    if (confirm("Hapus SEMUA data permanen?")) { 
        localStorage.removeItem('cuciSepatuDB'); 
        muatData(); 
    }
}

function backupData() {
    const db = localStorage.getItem('cuciSepatuDB');
    if (!db) return alert("Data kosong!");
    const blob = new Blob([db], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `Backup_Enam_Shoes.json`; a.click();
}

function prosesImport(event) {
    if (ROLE !== 'admin') return;
    const file = event.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (Array.isArray(data)) { 
                localStorage.setItem('cuciSepatuDB', JSON.stringify(data)); 
                muatData(); 
                alert("Restore Berhasil!"); 
            }
        } catch (err) { alert("File tidak valid!"); }
    };
    reader.readAsText(file);
}

window.onload = muatData;
