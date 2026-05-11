const USER_ROLE = sessionStorage.getItem('role');
const DEFAULT_LAYANAN = [
    { nama: 'Deep Clean', harga: 30000 },
    { nama: 'Unyellowing', harga: 40000 }, 
    { nama: 'Kids Shoes', harga: 25000 },
    { nama: 'Flat Shoes', harga: 25000 },
    { nama: 'Repaint', harga: 90000 }
];

let tTerakhir = null;

function checkAuth() {
    if (!USER_ROLE) { window.location.href = 'login.html'; }
}

function logout() {
    sessionStorage.clear();
    window.location.href = 'login.html';
}

function init() {
    checkAuth();
    if (USER_ROLE === 'staff') {
        const adminArea = document.getElementById('adminArea');
        if(adminArea) adminArea.style.display = 'none';
    }

    let stored = JSON.parse(localStorage.getItem('masterLayanan'));
    if (!stored) {
        localStorage.setItem('masterLayanan', JSON.stringify(DEFAULT_LAYANAN));
        stored = DEFAULT_LAYANAN;
    }

    document.getElementById('serviceList').innerHTML = stored.map((s, index) => {
        const btnHapus = USER_ROLE === 'admin' 
            ? `<button class="btn-del" onclick="hapusLayanan(${index})">🗑️</button>` 
            : '';

        return `
            <div class="service-item">
                <input type="checkbox" class="layanan" value="${s.harga}" data-nama="${s.nama}" onchange="hitungTotalOtomatis()" style="width:22px;height:22px;">
                <div class="service-info">${s.nama}<br><small style="color:#94a3b8">Rp ${s.harga.toLocaleString('id-ID')}</small></div>
                <div class="service-qty">
                    <input type="number" class="qty" value="1" min="1" oninput="hitungTotalOtomatis()">
                </div>
                ${btnHapus}
            </div>
        `;
    }).join('');
    
    toggleBayarInput(); 
    hitungTotalOtomatis();
}

function toggleBayarInput() {
    const status = document.getElementById('statusBayar').value;
    const inputBayar = document.getElementById('bayar');
    const inputMetode = document.getElementById('metodeBayar'); // Pastikan ambil element ini
    
    if (status === 'Belum Lunas') {
        inputBayar.value = 0;
        inputBayar.disabled = true;
        inputMetode.parentElement.style.opacity = "0.5"; // Memberi efek visual non-aktif
        document.getElementById('labelKembalian').innerText = "Kekurangan:";
    } else {
        inputBayar.disabled = false;
        inputMetode.parentElement.style.opacity = "1";
        document.getElementById('labelKembalian').innerText = "Kembalian:";
    }
    hitungTotalOtomatis();
}

function tambahLayananBaru() {
    if (USER_ROLE !== 'admin') return alert("Akses ditolak!");
    const nama = document.getElementById('newServiceName').value;
    const harga = parseInt(document.getElementById('newServicePrice').value);
    if (!nama || !harga) return alert("Isi nama dan harga!");
    const stored = JSON.parse(localStorage.getItem('masterLayanan'));
    stored.push({ nama, harga });
    localStorage.setItem('masterLayanan', JSON.stringify(stored));
    document.getElementById('newServiceName').value = "";
    document.getElementById('newServicePrice').value = "";
    init();
}

function hapusLayanan(index) {
    if (USER_ROLE !== 'admin') return alert("Akses ditolak!");
    if (confirm("Hapus layanan ini dari daftar?")) {
        const stored = JSON.parse(localStorage.getItem('masterLayanan'));
        stored.splice(index, 1);
        localStorage.setItem('masterLayanan', JSON.stringify(stored));
        init();
    }
}

function hitungTotalOtomatis() {
    let sub = 0;
    document.querySelectorAll('.service-item').forEach(item => {
        const cb = item.querySelector('.layanan');
        if (cb.checked) {
            const qty = parseInt(item.querySelector('.qty').value) || 0;
            sub += parseInt(cb.value) * qty;
        }
    });
    const diskon = parseInt(document.getElementById('diskon').value) || 0;
    const total = sub - diskon;
    const bayar = parseInt(document.getElementById('bayar').value) || 0;
    const kembali = bayar - total;
    
    document.getElementById('txtSubtotal').innerText = "Rp " + sub.toLocaleString('id-ID');
    document.getElementById('txtDiskon').innerText = "- Rp " + diskon.toLocaleString('id-ID');
    document.getElementById('txtTotalAkhir').innerText = "Rp " + (total < 0 ? 0 : total).toLocaleString('id-ID');
    
    const displayKembali = Math.abs(kembali);
    document.getElementById('txtKembalian').innerText = "Rp " + displayKembali.toLocaleString('id-ID');
    
    return { sub, diskon, total, bayar, kembali };
}

function prosesTransaksi() {
    const nama = document.getElementById('nama').value;
    let inputWa = document.getElementById('whatsapp').value;
    const metode = document.getElementById('metodeBayar').value;
    const sBayar = document.getElementById('statusBayar').value; 
    const calc = hitungTotalOtomatis();

    if(!nama || !inputWa || calc.sub === 0) return alert("Lengkapi data pelanggan dan layanan!");
    if(!sBayar) return alert("Silakan pilih Status Pembayaran!");

    // PERBAIKAN: Validasi metode hanya jika statusnya "Lunas"
    if(sBayar === 'Lunas' && !metode) {
        return alert("Silakan pilih Metode Pembayaran untuk pembayaran Lunas!");
    }
    
    let waSimpan = inputWa;
    if (waSimpan.startsWith('62')) {
        waSimpan = '0' + waSimpan.slice(2);
    } else if (!waSimpan.startsWith('0')) {
        waSimpan = '0' + waSimpan;
    }

    let waAPI = waSimpan.startsWith('0') ? '62' + waSimpan.slice(1) : waSimpan;

    let detailHtml = "", detailWA = "", layananSimpan = "", jmlSpt = 0;
    document.querySelectorAll('.service-item').forEach(item => {
        const cb = item.querySelector('.layanan');
        if (cb.checked) {
            let q = parseInt(item.querySelector('.qty').value);
            let hargaItem = parseInt(cb.value) * q;
            jmlSpt += q;
            detailHtml += `<div class="flex-between"><span>- ${cb.dataset.nama} (${q}x)</span><span>Rp ${hargaItem.toLocaleString('id-ID')}</span></div>`;
            detailWA += `- ${cb.dataset.nama} (${q}x) : Rp ${hargaItem.toLocaleString('id-ID')}\n`;
            layananSimpan += `${cb.dataset.nama} (${q}x), `;
        }
    });

    tTerakhir = {
        id: Date.now(),
        inv: "INV-" + Math.floor(1000 + Math.random() * 9000),
        tgl: new Date().toLocaleString('id-ID'),
        nama, 
        wa: waSimpan,
        metode, 
        statusBayar: sBayar,
        sub: Number(calc.sub), 
        diskon: Number(calc.diskon), 
        total: Number(calc.total), 
        bayar: Number(calc.bayar), 
        kembali: Number(calc.kembali),
        sepatu: jmlSpt, 
        detailHtml, 
        waList: detailWA, 
        layanan: layananSimpan.replace(/, $/, ""), 
        status: 'Belum Diambil'
    };

    const statusWA = tTerakhir.statusBayar === 'Belum Lunas' ? `*BELUM LUNAS (Tagihan: Rp ${Math.abs(tTerakhir.kembali).toLocaleString('id-ID')})*` : `*LUNAS*`;

    const pesanWA = `*ENAM SHOES CARE*\n--------------------------------\nNo. Nota : ${tTerakhir.inv}\nStatus : ${statusWA}\nTanggal : ${tTerakhir.tgl}\nNama : ${tTerakhir.nama}\nMetode : ${tTerakhir.metode}\n--------------------------------\n*LAYANAN:*\n${tTerakhir.waList}--------------------------------\nSubtotal : Rp ${tTerakhir.sub.toLocaleString('id-ID')}\nDiskon : Rp ${tTerakhir.diskon.toLocaleString('id-ID')}\n*TOTAL : Rp ${tTerakhir.total.toLocaleString('id-ID')}*\n--------------------------------\nBayar : Rp ${tTerakhir.bayar.toLocaleString('id-ID')}\n${tTerakhir.statusBayar === 'Belum Lunas' ? 'Sisa Tagihan' : 'Kembali'} : Rp ${Math.abs(tTerakhir.kembali).toLocaleString('id-ID')}\n--------------------------------\n*Terima Kasih Telah Mempercayakan*\n*Sepatu Anda Kepada Kami!*`;

    const db = JSON.parse(localStorage.getItem('cuciSepatuDB')) || [];
    db.push(tTerakhir);
    localStorage.setItem('cuciSepatuDB', JSON.stringify(db));

    window.open(`https://api.whatsapp.com/send?phone=${waAPI}&text=${encodeURIComponent(pesanWA)}`, '_blank');
    document.getElementById('printModal').style.display = 'block';
}

function cetakNotaFisik() {
    if (!tTerakhir) return;
    document.getElementById('notaInv').innerText = tTerakhir.inv;
    document.getElementById('notaTgl').innerText = "Tgl: " + tTerakhir.tgl;
    document.getElementById('notaNama').innerText = "Nama: " + tTerakhir.nama;
    document.getElementById('notaWA').innerText = "WA : " + tTerakhir.wa;
    document.getElementById('notaMetode').innerText = "Metode: " + tTerakhir.metode;
    
    const areaStatus = document.getElementById('areaStatusNota');
    if(tTerakhir.statusBayar === 'Belum Lunas') {
        areaStatus.innerHTML = `<div class="line"></div><div class="text-bold">STATUS: BELUM LUNAS</div><div class="line"></div>`;
        document.getElementById('labelNKembali').innerText = "SISA TAGIHAN:";
    } else {
        areaStatus.innerHTML = `<div class="text-bold">STATUS: LUNAS</div><div class="line"></div>`;
        document.getElementById('labelNKembali').innerText = "KEMBALI:";
    }

    document.getElementById('notaDetail').innerHTML = tTerakhir.detailHtml;
    document.getElementById('nSub').innerText = "Rp " + tTerakhir.sub.toLocaleString('id-ID');
    document.getElementById('nDisk').innerText = "-Rp " + tTerakhir.diskon.toLocaleString('id-ID');
    document.getElementById('nTotal').innerText = "Rp " + tTerakhir.total.toLocaleString('id-ID');
    document.getElementById('nBayar').innerText = "Rp " + tTerakhir.bayar.toLocaleString('id-ID');
    document.getElementById('nKembali').innerText = "Rp " + Math.abs(tTerakhir.kembali).toLocaleString('id-ID');
    
    window.print();
}

// Jalankan init saat halaman selesai dimuat
window.onload = init;
