import puppeteer from 'puppeteer';
import { writeFileSync } from 'fs';

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:'Inter',sans-serif;background:#f8fafc;color:#1e293b;line-height:1.6;}

  /* ── COVER ── */
  .cover{width:100%;height:100vh;background:linear-gradient(135deg,#1e3a8a 0%,#2563eb 50%,#3b82f6 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;page-break-after:always;position:relative;overflow:hidden;}
  .cover::before{content:'';position:absolute;width:600px;height:600px;border-radius:50%;background:rgba(255,255,255,0.05);top:-100px;right:-150px;}
  .cover::after{content:'';position:absolute;width:400px;height:400px;border-radius:50%;background:rgba(255,255,255,0.05);bottom:-80px;left:-100px;}
  .cover-badge{background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);color:#fff;font-size:12px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;padding:6px 18px;border-radius:100px;margin-bottom:24px;}
  .cover-logo-box{width:80px;height:80px;background:#fff;border-radius:20px;display:flex;align-items:center;justify-content:center;margin-bottom:24px;box-shadow:0 20px 40px rgba(0,0,0,0.2);}
  .cover-logo-box svg{width:48px;height:48px;}
  .cover h1{font-size:52px;font-weight:800;color:#fff;text-align:center;margin-bottom:12px;line-height:1.1;}
  .cover h1 span{color:#93c5fd;}
  .cover-sub{font-size:18px;color:rgba(255,255,255,0.8);text-align:center;max-width:480px;margin-bottom:48px;}
  .cover-meta{display:flex;gap:40px;}
  .cover-meta-item{text-align:center;}
  .cover-meta-item .val{font-size:28px;font-weight:700;color:#fff;}
  .cover-meta-item .lbl{font-size:12px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.1em;}
  .cover-footer{position:absolute;bottom:32px;font-size:12px;color:rgba(255,255,255,0.5);}

  /* ── SECTION PAGE ── */
  .section-cover{width:100%;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;page-break-before:always;page-break-after:always;background:#f1f5f9;}
  .section-num{font-size:120px;font-weight:800;color:#e2e8f0;line-height:1;}
  .section-title{font-size:36px;font-weight:700;color:#1e293b;margin-top:-20px;}
  .section-desc{font-size:15px;color:#64748b;margin-top:8px;max-width:400px;text-align:center;}

  /* ── CONTENT ── */
  .page{padding:60px;page-break-before:always;min-height:100vh;}
  .page-header{margin-bottom:32px;padding-bottom:20px;border-bottom:2px solid #e2e8f0;}
  .page-header h2{font-size:24px;font-weight:700;color:#1e293b;}
  .page-header p{font-size:14px;color:#64748b;margin-top:4px;}

  /* ── MOCKUP SCREEN ── */
  .screen{background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);overflow:hidden;margin-bottom:32px;border:1px solid #e2e8f0;}
  .screen-bar{background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:12px 16px;display:flex;align-items:center;gap:8px;}
  .dot{width:10px;height:10px;border-radius:50%;}
  .dot-r{background:#ff5f57;} .dot-y{background:#ffbd2e;} .dot-g{background:#28c840;}
  .screen-url{flex:1;background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:4px 10px;font-size:11px;color:#64748b;text-align:center;max-width:280px;margin:0 auto;}
  .screen-body{padding:0;}

  /* ── SIDEBAR MOCKUP ── */
  .app-layout{display:flex;height:540px;}
  .sidebar{width:200px;background:#fff;border-right:1px solid #e2e8f0;flex-shrink:0;display:flex;flex-direction:column;}
  .sidebar-logo{padding:16px;border-bottom:1px solid #f1f5f9;font-size:14px;font-weight:700;color:#2563eb;display:flex;align-items:center;gap:8px;}
  .sidebar-logo svg{width:24px;height:24px;}
  .sidebar-nav{padding:12px 8px;flex:1;}
  .nav-label{font-size:9px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8;padding:4px 8px;margin-bottom:4px;}
  .nav-item{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;font-size:12px;color:#64748b;margin-bottom:2px;}
  .nav-item.active{background:#eff6ff;color:#2563eb;font-weight:600;}
  .nav-item svg{width:14px;height:14px;opacity:0.6;}
  .nav-item.active svg{opacity:1;color:#2563eb;}
  .main-content{flex:1;background:#f8fafc;overflow:hidden;display:flex;flex-direction:column;}
  .topbar{background:#fff;border-bottom:1px solid #e2e8f0;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;}
  .topbar-title{font-size:14px;font-weight:700;color:#1e293b;}
  .topbar-user{display:flex;align-items:center;gap:8px;}
  .avatar{width:28px;height:28px;border-radius:50%;background:#2563eb;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;}
  .content-area{flex:1;padding:16px;overflow:hidden;}

  /* ── CARDS ── */
  .stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px;}
  .stat-card{background:#fff;border-radius:10px;padding:12px;border:1px solid #e2e8f0;}
  .stat-label{font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;}
  .stat-value{font-size:20px;font-weight:700;color:#1e293b;margin-top:2px;}
  .stat-sub{font-size:9px;color:#94a3b8;margin-top:1px;}
  .stat-card.blue{border-left:3px solid #3b82f6;}
  .stat-card.green{border-left:3px solid #10b981;}
  .stat-card.amber{border-left:3px solid #f59e0b;}
  .stat-card.rose{border-left:3px solid #f43f5e;}

  /* ── TABLE ── */
  .table-card{background:#fff;border-radius:10px;border:1px solid #e2e8f0;overflow:hidden;}
  .table-head{background:#f8fafc;display:grid;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;padding:8px 12px;border-bottom:1px solid #e2e8f0;}
  .table-row{display:grid;font-size:11px;color:#374151;padding:9px 12px;border-bottom:1px solid #f1f5f9;align-items:center;}
  .table-row:last-child{border-bottom:none;}
  .badge{display:inline-block;padding:2px 8px;border-radius:100px;font-size:9px;font-weight:600;}
  .badge-new{background:#f1f5f9;color:#475569;}
  .badge-active{background:#d1fae5;color:#065f46;}
  .badge-repeat{background:#dbeafe;color:#1e40af;}
  .badge-dormant{background:#fef3c7;color:#92400e;}
  .badge-churn{background:#ffe4e6;color:#9f1239;}
  .donor-avatar{width:24px;height:24px;border-radius:50%;background:#dbeafe;display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#1d4ed8;margin-right:6px;}

  /* ── FILTERS ── */
  .filter-bar{background:#fff;border-radius:10px;border:1px solid #e2e8f0;padding:10px 12px;margin-bottom:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;}
  .filter-input{border:1px solid #e2e8f0;border-radius:8px;padding:5px 10px;font-size:10px;color:#374151;background:#f8fafc;display:flex;align-items:center;gap:4px;}
  .filter-select{border:1px solid #e2e8f0;border-radius:8px;padding:5px 10px;font-size:10px;color:#374151;background:#f8fafc;}
  .btn-primary{background:#2563eb;color:#fff;border:none;border-radius:8px;padding:5px 12px;font-size:10px;font-weight:600;cursor:pointer;}
  .btn-outline{background:#fff;color:#374151;border:1px solid #e2e8f0;border-radius:8px;padding:5px 12px;font-size:10px;font-weight:600;}
  .chip{background:#eff6ff;color:#1d4ed8;border-radius:100px;padding:2px 8px;font-size:9px;font-weight:600;display:inline-flex;align-items:center;gap:4px;}

  /* ── CHART MOCKUP ── */
  .chart-bar-wrap{display:flex;align-items:flex-end;gap:4px;height:80px;padding:0 4px;}
  .bar{background:#3b82f6;border-radius:4px 4px 0 0;min-width:14px;flex:1;opacity:0.85;}
  .bar:nth-child(odd){opacity:0.6;}
  .line-chart{position:relative;height:80px;margin-top:8px;}
  .line-chart svg{width:100%;height:100%;}

  /* ── INFO BOXES ── */
  .info-box{background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px;margin-bottom:16px;}
  .info-box h4{font-size:13px;font-weight:700;color:#1e40af;margin-bottom:6px;}
  .info-box p, .info-box li{font-size:12px;color:#1e3a8a;line-height:1.7;}
  .info-box ul{padding-left:16px;}
  .warn-box{background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:16px;margin-bottom:16px;}
  .warn-box h4{font-size:13px;font-weight:700;color:#92400e;margin-bottom:6px;}
  .warn-box p{font-size:12px;color:#78350f;line-height:1.7;}
  .success-box{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px;margin-bottom:16px;}
  .success-box h4{font-size:13px;font-weight:700;color:#14532d;margin-bottom:6px;}
  .success-box p{font-size:12px;color:#166534;line-height:1.7;}

  /* ── ROLES TABLE ── */
  .roles-table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px;}
  .roles-table th{background:#f8fafc;padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;border-bottom:2px solid #e2e8f0;}
  .roles-table td{padding:10px 14px;border-bottom:1px solid #f1f5f9;color:#374151;}
  .roles-table tr:last-child td{border-bottom:none;}
  .tick{color:#10b981;font-weight:700;}
  .cross{color:#f43f5e;font-weight:700;}

  /* ── SCHEMA TABLE ── */
  .schema-table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:24px;}
  .schema-table th{background:#f8fafc;padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;border-bottom:2px solid #e2e8f0;}
  .schema-table td{padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#374151;vertical-align:top;}
  .schema-table tr:last-child td{border-bottom:none;}
  .code{font-family:monospace;background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:11px;color:#0f172a;}
  .pk{background:#fef3c7;color:#92400e;} .fk{background:#dbeafe;color:#1e40af;} .uq{background:#d1fae5;color:#065f46;}

  /* ── FLOW ── */
  .flow{display:flex;flex-direction:column;gap:0;margin-bottom:24px;}
  .flow-step{display:flex;align-items:flex-start;gap:14px;padding:14px 16px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:8px;}
  .flow-num{width:28px;height:28px;border-radius:50%;background:#2563eb;color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
  .flow-content h4{font-size:13px;font-weight:600;color:#1e293b;}
  .flow-content p{font-size:12px;color:#64748b;margin-top:2px;}
  .flow-arrow{text-align:center;font-size:18px;color:#cbd5e1;margin:-4px 0;}

  /* ── ENV TABLE ── */
  .env-table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px;}
  .env-table th{background:#f8fafc;padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;border-bottom:2px solid #e2e8f0;}
  .env-table td{padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#374151;font-family:monospace;font-size:11px;}
  .env-table td:first-child{font-weight:600;color:#1e293b;}
  .env-table td:last-child{color:#64748b;font-family:inherit;font-size:12px;}
  .env-table tr:last-child td{border-bottom:none;}

  /* ── TWO COL ── */
  .two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;}
  .card{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px;}
  .card h4{font-size:13px;font-weight:700;color:#1e293b;margin-bottom:8px;}
  .card p, .card li{font-size:12px;color:#64748b;line-height:1.7;}
  .card ul{padding-left:16px;}

  /* ── PRINT ── */
  @media print {
    .page{page-break-before:always;}
    .cover{page-break-after:always;}
  }
  @page{margin:0;size:A4;}
</style>
</head>
<body>

<!-- ══════════════════ COVER ══════════════════ -->
<div class="cover">
  <div class="cover-badge">System Documentation · 2025</div>
  <div class="cover-logo-box">
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="12" fill="#2563eb"/>
      <path d="M24 8C15.16 8 8 15.16 8 24s7.16 16 16 16 16-7.16 16-16S32.84 8 24 8zm0 6c2.21 0 4 1.79 4 4s-1.79 4-4 4-4-1.79-4-4 1.79-4 4-4zm0 22.4c-3.33 0-6.29-1.7-8-4.28.04-2.65 5.33-4.12 8-4.12 2.66 0 7.96 1.47 8 4.12-1.71 2.58-4.67 4.28-8 4.28z" fill="white"/>
    </svg>
  </div>
  <h1>IhsanKu<br/><span>Donor Analytics</span></h1>
  <p class="cover-sub">Sistem pengurusan dan analitik derma untuk NGO — lengkap dengan dashboard, CSV import, webhook, dan laporan terperinci.</p>
  <div class="cover-meta">
    <div class="cover-meta-item"><div class="val">React 18</div><div class="lbl">Frontend</div></div>
    <div class="cover-meta-item"><div class="val">Express</div><div class="lbl">Backend</div></div>
    <div class="cover-meta-item"><div class="val">Supabase</div><div class="lbl">Database</div></div>
    <div class="cover-meta-item"><div class="val">Railway</div><div class="lbl">Hosting</div></div>
  </div>
  <div class="cover-footer">IhsanKu · KZD Tech · Versi 1.0 · Mei 2025</div>
</div>

<!-- ══════════════════ TABLE OF CONTENTS ══════════════════ -->
<div class="page">
  <div class="page-header">
    <h2>Kandungan Dokumen</h2>
    <p>Panduan lengkap sistem IhsanKu Donor Analytics</p>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
    ${[
      ['01','Pengenalan Sistem','Gambaran keseluruhan, tujuan & teknologi'],
      ['02','Dashboard','Statistik utama & analitik ringkas'],
      ['03','Halaman Donors','Senarai lengkap donor & filter lanjutan'],
      ['04','Tambah Derma','Input manual & bulk CSV upload'],
      ['05','Analitik & Carta','Analisis trend, sumber & prestasi'],
      ['06','Webhooks','Integrasi pihak ketiga & log aktiviti'],
      ['07','Pengurusan Staff','Tambah, edit & padam staf'],
      ['08','Pengurusan Pengguna','Kawalan akses & peranan'],
      ['09','Struktur Database','Schema table & hubungan data'],
      ['10','Peranan & Kebenaran','Matriks akses mengikut peranan'],
      ['11','CSV Import Guide','Format, flow & penyelesaian masalah'],
      ['12','Persediaan Sistem','Environment variables & setup'],
    ].map(([n,t,d]) => `
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px;display:flex;align-items:flex-start;gap:12px;">
      <div style="width:32px;height:32px;background:#eff6ff;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#2563eb;flex-shrink:0;">${n}</div>
      <div><div style="font-size:13px;font-weight:600;color:#1e293b;">${t}</div><div style="font-size:11px;color:#64748b;margin-top:2px;">${d}</div></div>
    </div>`).join('')}
  </div>
</div>

<!-- ══════════════════ 01 PENGENALAN ══════════════════ -->
<div class="section-cover">
  <div class="section-num">01</div>
  <div class="section-title">Pengenalan Sistem</div>
  <div class="section-desc">Gambaran keseluruhan platform IhsanKu dan teknologi yang digunakan</div>
</div>

<div class="page">
  <div class="page-header">
    <h2>01 · Pengenalan Sistem</h2>
    <p>IhsanKu adalah platform pengurusan derma berbasis web untuk pertubuhan NGO.</p>
  </div>

  <div class="info-box">
    <h4>Apa itu IhsanKu?</h4>
    <p>IhsanKu adalah sistem analitik donor yang membolehkan NGO mengurus, menjejak dan menganalisis semua rekod derma dalam satu platform berpusat. Data boleh dimasukkan secara manual, melalui upload CSV, atau terus ke Supabase.</p>
  </div>

  <div class="two-col">
    <div class="card">
      <h4>Tujuan Sistem</h4>
      <ul>
        <li>Rekod & urus data donor secara terpusat</li>
        <li>Jejak sejarah dan corak derma</li>
        <li>Kenal pasti donor bernilai tinggi (High Value)</li>
        <li>Analitik sumber derma (Facebook, TikTok, dll)</li>
        <li>Hantar notifikasi webhook ke sistem luar</li>
        <li>Kawalan akses berbilang peranan</li>
      </ul>
    </div>
    <div class="card">
      <h4>Tech Stack</h4>
      <ul>
        <li><strong>Frontend:</strong> React 18 + Vite + Tailwind CSS</li>
        <li><strong>Backend:</strong> Express.js (Node.js ES Modules)</li>
        <li><strong>Database:</strong> Supabase (PostgreSQL)</li>
        <li><strong>Hosting:</strong> Railway (auto-deploy dari GitHub)</li>
        <li><strong>Auth:</strong> HMAC-SHA256 stateless token</li>
        <li><strong>Password:</strong> scrypt hashing</li>
      </ul>
    </div>
  </div>

  <div class="two-col">
    <div class="card">
      <h4>Ciri-ciri Utama</h4>
      <ul>
        <li>Dashboard ringkasan statistik donor</li>
        <li>Senarai donor dengan filter pelbagai</li>
        <li>Upload CSV bulk (sehingga ribuan baris)</li>
        <li>Analitik trend & sumber</li>
        <li>Carta visual interaktif</li>
        <li>Webhook outbound ke sistem luar</li>
        <li>Pengurusan staff & pengguna</li>
        <li>Detect & merge rekod duplikat</li>
      </ul>
    </div>
    <div class="card">
      <h4>Status Donor</h4>
      <ul>
        <li><strong>New</strong> — Derma pertama, &lt; 30 hari</li>
        <li><strong>Active</strong> — Ada derma dalam 90 hari</li>
        <li><strong>Repeat</strong> — Lebih dari 1 kali derma</li>
        <li><strong>Dormant</strong> — Tiada derma 90–365 hari</li>
        <li><strong>Churned</strong> — Tiada derma &gt; 365 hari</li>
        <li><strong>High Value</strong> — Jumlah ≥ RM 1,000</li>
      </ul>
    </div>
  </div>
</div>

<!-- ══════════════════ 02 DASHBOARD ══════════════════ -->
<div class="section-cover">
  <div class="section-num">02</div>
  <div class="section-title">Dashboard</div>
  <div class="section-desc">Statistik utama, ringkasan koleksi dan senarai donor</div>
</div>

<div class="page">
  <div class="page-header">
    <h2>02 · Dashboard</h2>
    <p>Halaman utama — paparan ringkasan semua statistik donor dan koleksi derma.</p>
  </div>

  <div class="screen">
    <div class="screen-bar">
      <div class="dot dot-r"></div><div class="dot dot-y"></div><div class="dot dot-g"></div>
      <div class="screen-url">app.ihsanku.com / Dashboard</div>
    </div>
    <div class="screen-body">
      <div class="app-layout">
        <div class="sidebar">
          <div class="sidebar-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
            IhsanKu
          </div>
          <div class="sidebar-nav">
            <div class="nav-label">General</div>
            <div class="nav-item active">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              Dashboard
            </div>
            <div class="nav-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Donors
            </div>
            <div class="nav-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
              Analytics
            </div>
            <div class="nav-label" style="margin-top:12px;">Management</div>
            <div class="nav-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
              Add Donation
            </div>
            <div class="nav-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              Duplicates
            </div>
          </div>
        </div>
        <div class="main-content">
          <div class="topbar">
            <div class="topbar-title">Dashboard</div>
            <div class="topbar-user">
              <div style="text-align:right;font-size:10px;"><div style="font-weight:600;color:#1e293b;">Admin User</div><div style="color:#94a3b8;">admin</div></div>
              <div class="avatar">A</div>
            </div>
          </div>
          <div class="content-area">
            <div class="stat-grid">
              <div class="stat-card blue"><div class="stat-label">Total Donors</div><div class="stat-value">2,847</div><div class="stat-sub">+124 bulan ini</div></div>
              <div class="stat-card green"><div class="stat-label">Total Collection</div><div class="stat-value">RM 487K</div><div class="stat-sub">+RM 23K bulan ini</div></div>
              <div class="stat-card amber"><div class="stat-label">Transactions</div><div class="stat-value">9,421</div><div class="stat-sub">Jumlah transaksi</div></div>
              <div class="stat-card rose"><div class="stat-label">Avg. Donation</div><div class="stat-value">RM 51.70</div><div class="stat-sub">Per transaksi</div></div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:10px;">
              ${[['New','438','badge-new'],['Active','1,203','badge-active'],['Repeat','612','badge-repeat'],['Dormant','394','badge-dormant'],['Churned','200','badge-churn']].map(([l,v,b])=>`
              <div class="stat-card"><div style="display:flex;justify-content:space-between;align-items:center;"><div class="stat-label">${l}</div><span class="badge ${b}">${l}</span></div><div class="stat-value" style="font-size:16px;">${v}</div></div>`).join('')}
            </div>
            <div class="table-card">
              <div class="table-head" style="grid-template-columns:2fr 1fr 1fr 1fr 1fr 1fr;">
                <span>Donor</span><span>Transactions</span><span>Total</span><span>First</span><span>Latest</span><span>Status</span>
              </div>
              ${[
                ['Ahmad Faris','60112345678','3','RM 250','2024-01-10','2024-12-01','repeat'],
                ['Siti Rahimah','60187654321','1','RM 50','2024-11-20','2024-11-20','new'],
                ['Mohd Hafiz','60161112233','5','RM 1,500','2023-06-01','2024-10-15','repeat'],
                ['Nurul Aina','60134445566','2','RM 200','2024-03-08','2024-08-20','active'],
              ].map(([n,p,t,tot,f,l,s])=>`
              <div class="table-row" style="grid-template-columns:2fr 1fr 1fr 1fr 1fr 1fr;">
                <div style="display:flex;align-items:center;"><div class="donor-avatar">${n[0]}</div><div><div style="font-weight:600;font-size:11px;">${n}</div><div style="font-size:9px;color:#94a3b8;">${p}</div></div></div>
                <div>${t}</div><div style="font-weight:600;">${tot}</div><div>${f}</div><div>${l}</div>
                <div><span class="badge badge-${s}">${s}</span></div>
              </div>`).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="two-col">
    <div class="info-box" style="margin:0;">
      <h4>Filter & Carian</h4>
      <p>Dashboard mempunyai carian nama/phone/email, filter status donor, filter tarikh (From–To), dan semua kolum dalam jadual boleh disusun (sort) secara menaik atau menurun.</p>
    </div>
    <div class="info-box" style="margin:0;">
      <h4>Statistik Dikira Automatik</h4>
      <p>Semua angka pada dashboard dikira secara automatik dari <code style="font-family:monospace;background:#dbeafe;padding:1px 4px;border-radius:3px;">donor_summary</code> VIEW dalam Supabase — tiada kira manual diperlukan.</p>
    </div>
  </div>
</div>

<!-- ══════════════════ 03 DONORS ══════════════════ -->
<div class="section-cover">
  <div class="section-num">03</div>
  <div class="section-title">Halaman Donors</div>
  <div class="section-desc">Senarai lengkap donor dengan filter dan export CSV</div>
</div>

<div class="page">
  <div class="page-header">
    <h2>03 · Halaman Donors</h2>
    <p>Paparan penuh semua donor dengan filter lanjutan, sort kolum, dan export.</p>
  </div>

  <div class="screen">
    <div class="screen-bar">
      <div class="dot dot-r"></div><div class="dot dot-y"></div><div class="dot dot-g"></div>
      <div class="screen-url">app.ihsanku.com/donors</div>
    </div>
    <div class="screen-body" style="padding:16px;background:#f8fafc;">
      <!-- Header row -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <div><div style="font-size:16px;font-weight:700;color:#1e293b;">Donors</div><div style="font-size:11px;color:#64748b;">Full donor list with advanced filters.</div></div>
        <div style="display:flex;align-items:center;gap:8px;">
          <div class="filter-input">📅 2024-01-01</div>
          <span style="color:#94a3b8;font-size:12px;">—</span>
          <div class="filter-input">📅 2024-12-31</div>
          <button class="btn-outline">⬇ Export CSV</button>
        </div>
      </div>
      <!-- Filter bar -->
      <div class="filter-bar" style="margin-bottom:8px;">
        <div class="filter-input">🔍 Search name, email, phone…</div>
        <select class="filter-select"><option>All Status</option></select>
        <select class="filter-select"><option>All Source</option></select>
        <select class="filter-select"><option>All</option></select>
        <div style="display:flex;gap:6px;margin-left:auto;">
          <span class="chip">Active ×</span>
          <span class="chip">Facebook ×</span>
          <span style="font-size:10px;color:#94a3b8;text-decoration:underline;cursor:pointer;">Clear all</span>
        </div>
      </div>
      <!-- Table -->
      <div class="table-card">
        <div style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:10px;font-weight:600;color:#64748b;">1–50 of 2,847 donors</div>
        <div class="table-head" style="grid-template-columns:2.5fr 1.2fr 1fr 0.8fr 1fr 1fr 1fr 0.8fr 0.8fr 0.8fr;">
          <span>Donor ↕</span><span>Phone</span><span>Source ↕</span><span>Trans ↕</span><span>Total ↕</span><span>First ↕</span><span>Latest ↕</span><span>Avg ↕</span><span>HV ↕</span><span>Status ↕</span>
        </div>
        ${[
          ['Ahmad Faris','ali@gmail.com','60112345678','Facebook','3','RM 250','2024-01-10','2024-12-01','RM 83','✅','repeat'],
          ['Siti Rahimah','siti@gmail.com','60187654321','TikTok','1','RM 50','2024-11-20','2024-11-20','RM 50','❌','new'],
          ['Mohd Hafiz','hafiz@gmail.com','60161112233','Youtube/Google','5','RM 1,500','2023-06-01','2024-10-15','RM 300','✅','repeat'],
          ['Nurul Aina','aina@gmail.com','60134445566','Facebook','2','RM 200','2024-03-08','2024-08-20','RM 100','❌','active'],
          ['Razif Malik','razif@gmail.com','60145556677','DRM','4','RM 900','2023-12-01','2024-09-10','RM 225','❌','dormant'],
        ].map(([n,e,p,src,t,tot,f,l,avg,hv,s])=>`
        <div class="table-row" style="grid-template-columns:2.5fr 1.2fr 1fr 0.8fr 1fr 1fr 1fr 0.8fr 0.8fr 0.8fr;">
          <div style="display:flex;align-items:center;"><div class="donor-avatar">${n[0]}</div><div><div style="font-weight:600;font-size:11px;">${n}</div><div style="font-size:9px;color:#94a3b8;">${e}</div></div></div>
          <div style="font-size:10px;">${p}</div>
          <div style="font-size:10px;">${src}</div>
          <div>${t}</div>
          <div style="font-weight:600;font-size:10px;">${tot}</div>
          <div style="font-size:10px;">${f}</div>
          <div style="font-size:10px;">${l}</div>
          <div style="font-size:10px;">${avg}</div>
          <div style="text-align:center;">${hv}</div>
          <div><span class="badge badge-${s}">${s}</span></div>
        </div>`).join('')}
      </div>
      <!-- Pagination -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;">
        <button class="btn-outline" style="padding:4px 10px;">← Prev</button>
        <span style="font-size:11px;color:#64748b;">Page 1 of 57</span>
        <button class="btn-outline" style="padding:4px 10px;">Next →</button>
      </div>
    </div>
  </div>

  <div class="two-col">
    <div class="card">
      <h4>Filter Tersedia</h4>
      <ul>
        <li><strong>Search</strong> — cari nama, emel, atau phone</li>
        <li><strong>Status</strong> — New, Active, Repeat, Dormant, Churned</li>
        <li><strong>Source</strong> — Facebook, Youtube/Google, TikTok, DRM, Others</li>
        <li><strong>High Value</strong> — Ya (≥RM1K) atau Regular</li>
        <li><strong>Date Range</strong> — From & To tarikh derma</li>
      </ul>
    </div>
    <div class="card">
      <h4>Kolum Boleh Sort</h4>
      <ul>
        <li>Nama Donor</li>
        <li>Source</li>
        <li>Transactions (bilangan)</li>
        <li>Total (jumlah derma)</li>
        <li>First Donation (tarikh pertama)</li>
        <li>Latest Donation (terkini)</li>
        <li>Average (AOV)</li>
        <li>High Value & Status</li>
      </ul>
    </div>
  </div>
</div>

<!-- ══════════════════ 04 TAMBAH DERMA ══════════════════ -->
<div class="section-cover">
  <div class="section-num">04</div>
  <div class="section-title">Tambah Derma</div>
  <div class="section-desc">Input manual satu rekod atau upload CSV secara bulk</div>
</div>

<div class="page">
  <div class="page-header">
    <h2>04 · Tambah Derma</h2>
    <p>Masukkan rekod derma secara manual atau upload CSV untuk import data dalam jumlah besar.</p>
  </div>

  <div class="screen">
    <div class="screen-bar">
      <div class="dot dot-r"></div><div class="dot dot-y"></div><div class="dot dot-g"></div>
      <div class="screen-url">app.ihsanku.com/order-input · Add Donation</div>
    </div>
    <div class="screen-body" style="padding:20px;background:#f8fafc;display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <!-- Manual form -->
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;">
        <div style="font-size:13px;font-weight:700;color:#1e293b;margin-bottom:14px;">✏️ Manual Entry</div>
        ${[['Nama Donor','Ahmad Faris'],['Phone','60112345678'],['Email','ahmad@gmail.com'],['Tarikh Derma','2024-12-01'],['Jumlah (RM)','50.00'],['Sumber','Facebook'],['Kempen','FB-Ramadan2024']].map(([l,v])=>`
        <div style="margin-bottom:10px;">
          <div style="font-size:10px;font-weight:600;color:#64748b;margin-bottom:3px;">${l}</div>
          <div style="border:1px solid #e2e8f0;border-radius:8px;padding:7px 10px;font-size:11px;color:#374151;background:#f8fafc;">${v}</div>
        </div>`).join('')}
        <button class="btn-primary" style="width:100%;padding:8px;margin-top:4px;">Simpan Derma</button>
      </div>
      <!-- CSV Upload -->
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;">
        <div style="font-size:13px;font-weight:700;color:#1e293b;margin-bottom:14px;">📂 CSV Bulk Upload</div>
        <div style="border:2px dashed #bfdbfe;border-radius:10px;padding:24px;text-align:center;margin-bottom:14px;background:#f0f9ff;">
          <div style="font-size:24px;margin-bottom:8px;">📁</div>
          <div style="font-size:12px;font-weight:600;color:#1d4ed8;">Drag & drop fail CSV</div>
          <div style="font-size:10px;color:#64748b;margin-top:4px;">atau klik untuk pilih fail</div>
        </div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;font-family:monospace;font-size:9px;color:#475569;margin-bottom:14px;line-height:1.8;">
          <div style="font-weight:700;color:#1e293b;font-family:sans-serif;font-size:10px;margin-bottom:4px;">Format CSV:</div>
          name,phone,email,donation_date,amount,source,campaign<br/>
          Ahmad,60112345678,a@gmail.com,2024-01-15,50.00,Facebook,FB-ramadan
        </div>
        <div style="background:#d1fae5;border:1px solid #6ee7b7;border-radius:8px;padding:10px;font-size:10px;color:#065f46;margin-bottom:14px;">
          ✅ 2,847 baris berjaya diproses<br/>
          ✅ 1,203 donor baru ditambah<br/>
          ✅ 9,421 transaksi direkodkan
        </div>
        <button class="btn-primary" style="width:100%;padding:8px;">Upload & Proses CSV</button>
      </div>
    </div>
  </div>

  <div class="info-box">
    <h4>Proses CSV Upload</h4>
    <p>Sistem memproses CSV dalam <strong>chunk 300 baris</strong> setiap kali untuk elak timeout. Setiap chunk: (1) cek phone/email dalam donors table, (2) insert donor baru jika tiada, (3) insert transaksi derma. Donors yang sama tidak akan duplikat.</p>
  </div>

  <div class="warn-box">
    <h4>⚠️ Penting: Duplikat Donations</h4>
    <p>Upload CSV yang sama dua kali akan duplikat donations (transaksi akan dikira dua kali). Donors tidak akan duplikat kerana dilindungi UNIQUE constraint pada phone & email. Pastikan setiap CSV diupload satu kali sahaja.</p>
  </div>
</div>

<!-- ══════════════════ 05 ANALITIK ══════════════════ -->
<div class="section-cover">
  <div class="section-num">05</div>
  <div class="section-title">Analitik & Carta</div>
  <div class="section-desc">Trend derma, analisis sumber dan prestasi kempen</div>
</div>

<div class="page">
  <div class="page-header">
    <h2>05 · Analitik & Carta</h2>
    <p>Visualisasi data derma mengikut tempoh masa, sumber dan corak donor.</p>
  </div>

  <div class="screen">
    <div class="screen-bar">
      <div class="dot dot-r"></div><div class="dot dot-y"></div><div class="dot dot-g"></div>
      <div class="screen-url">app.ihsanku.com/analytics · Analytics</div>
    </div>
    <div class="screen-body" style="padding:16px;background:#f8fafc;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
        <!-- Monthly chart -->
        <div class="stat-card" style="padding:14px;">
          <div class="stat-label" style="margin-bottom:10px;">Koleksi Bulanan (RM)</div>
          <div class="chart-bar-wrap">
            ${[40,55,35,70,65,80,45,90,75,60,85,95].map(h=>`<div class="bar" style="height:${h}%;"></div>`).join('')}
          </div>
          <div style="display:flex;justify-content:space-between;font-size:8px;color:#94a3b8;margin-top:4px;">
            <span>Jan</span><span>Feb</span><span>Mac</span><span>Apr</span><span>Mei</span><span>Jun</span><span>Jul</span><span>Ogo</span><span>Sep</span><span>Okt</span><span>Nov</span><span>Dis</span>
          </div>
        </div>
        <!-- Source pie chart mockup -->
        <div class="stat-card" style="padding:14px;">
          <div class="stat-label" style="margin-bottom:10px;">Sumber Derma</div>
          <div style="display:flex;gap:12px;align-items:center;">
            <svg width="80" height="80" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="30" fill="none" stroke="#3b82f6" stroke-width="20" stroke-dasharray="95 100" stroke-dashoffset="0"/>
              <circle cx="40" cy="40" r="30" fill="none" stroke="#10b981" stroke-width="20" stroke-dasharray="40 100" stroke-dashoffset="-95"/>
              <circle cx="40" cy="40" r="30" fill="none" stroke="#f59e0b" stroke-width="20" stroke-dasharray="25 100" stroke-dashoffset="-135"/>
              <circle cx="40" cy="40" r="30" fill="none" stroke="#f43f5e" stroke-width="20" stroke-dasharray="15 100" stroke-dashoffset="-160"/>
              <circle cx="40" cy="40" r="30" fill="none" stroke="#a78bfa" stroke-width="20" stroke-dasharray="25 100" stroke-dashoffset="-175"/>
              <circle cx="40" cy="40" r="18" fill="white"/>
            </svg>
            <div style="flex:1;">
              ${[['#3b82f6','Facebook','38%'],['#10b981','Youtube/Google','16%'],['#f59e0b','TikTok','10%'],['#f43f5e','DRM','6%'],['#a78bfa','Others','30%']].map(([c,l,p])=>`
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;">
                <div style="width:8px;height:8px;border-radius:2px;background:${c};flex-shrink:0;"></div>
                <span style="font-size:10px;color:#374151;flex:1;">${l}</span>
                <span style="font-size:10px;font-weight:600;color:#1e293b;">${p}</span>
              </div>`).join('')}
            </div>
          </div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
        <div class="stat-card"><div class="stat-label">New Donors (bulan ini)</div><div class="stat-value" style="color:#3b82f6;">+124</div></div>
        <div class="stat-card"><div class="stat-label">High Value Donors</div><div class="stat-value" style="color:#10b981;">287</div></div>
        <div class="stat-card"><div class="stat-label">Avg. Order Value</div><div class="stat-value" style="color:#f59e0b;">RM 51.70</div></div>
      </div>
    </div>
  </div>

  <div class="screen" style="margin-top:16px;">
    <div class="screen-bar">
      <div class="dot dot-r"></div><div class="dot dot-y"></div><div class="dot dot-g"></div>
      <div class="screen-url">app.ihsanku.com/charts · Charts</div>
    </div>
    <div class="screen-body" style="padding:16px;background:#f8fafc;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="stat-card" style="padding:14px;">
          <div class="stat-label" style="margin-bottom:8px;">Trend Donor Baru (6 bulan)</div>
          <svg viewBox="0 0 200 80" width="100%" height="80">
            <polyline points="10,60 44,40 78,50 112,20 146,30 180,10" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linejoin="round"/>
            <polyline points="10,60 44,40 78,50 112,20 146,30 180,10" fill="url(#grad)" opacity="0.15"/>
            <defs><linearGradient id="grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3b82f6"/><stop offset="100%" stop-color="white"/></linearGradient></defs>
            ${[[10,60],[44,40],[78,50],[112,20],[146,30],[180,10]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="3" fill="#3b82f6"/>`).join('')}
          </svg>
        </div>
        <div class="stat-card" style="padding:14px;">
          <div class="stat-label" style="margin-bottom:8px;">Status Distribution</div>
          <div style="display:flex;flex-direction:column;gap:5px;">
            ${[['Active','1,203','#10b981',42],['New','438','#3b82f6',15],['Repeat','612','#6366f1',22],['Dormant','394','#f59e0b',14],['Churned','200','#f43f5e',7]].map(([l,v,c,w])=>`
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:9px;color:#64748b;width:50px;">${l}</span>
              <div style="flex:1;background:#f1f5f9;border-radius:4px;height:8px;overflow:hidden;">
                <div style="width:${w}%;height:100%;background:${c};border-radius:4px;"></div>
              </div>
              <span style="font-size:9px;font-weight:600;color:#1e293b;width:35px;text-align:right;">${v}</span>
            </div>`).join('')}
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- ══════════════════ 06 WEBHOOKS ══════════════════ -->
<div class="section-cover">
  <div class="section-num">06</div>
  <div class="section-title">Webhooks</div>
  <div class="section-desc">Integrasi outbound ke sistem pihak ketiga</div>
</div>

<div class="page">
  <div class="page-header">
    <h2>06 · Webhooks</h2>
    <p>Hantar notifikasi automatik ke URL luar apabila berlaku event dalam sistem.</p>
  </div>

  <div class="screen">
    <div class="screen-bar">
      <div class="dot dot-r"></div><div class="dot dot-y"></div><div class="dot dot-g"></div>
      <div class="screen-url">app.ihsanku.com/webhooks · Webhooks</div>
    </div>
    <div class="screen-body" style="padding:16px;background:#f8fafc;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <div style="font-size:13px;font-weight:700;color:#1e293b;">Webhook Configurations</div>
        <button class="btn-primary">+ Tambah Webhook</button>
      </div>
      ${[
        ['Slack Notifikasi','https://hooks.slack.com/services/xxx','donation.created','Aktif'],
        ['CRM Integration','https://crm.company.com/webhook','donor.created,donation.created','Aktif'],
        ['Analytics Platform','https://analytics.io/ingest/xxx','donation.created','Tidak Aktif'],
      ].map(([n,u,e,s])=>`
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div style="font-size:12px;font-weight:600;color:#1e293b;">${n}</div>
          <div style="font-size:10px;color:#64748b;font-family:monospace;margin-top:2px;">${u}</div>
          <div style="font-size:10px;color:#94a3b8;margin-top:2px;">Events: ${e}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="badge ${s==='Aktif'?'badge-active':'badge-dormant'}">${s}</span>
          <button class="btn-outline" style="font-size:9px;padding:3px 8px;">Edit</button>
        </div>
      </div>`).join('')}
      <div style="margin-top:14px;font-size:12px;font-weight:700;color:#1e293b;margin-bottom:8px;">Log Aktiviti Terkini</div>
      ${[
        ['✅','200','donation.created','Slack Notifikasi','2 minit lalu'],
        ['✅','200','donor.created','CRM Integration','15 minit lalu'],
        ['❌','500','donation.created','Analytics Platform','1 jam lalu'],
      ].map(([ico,code,event,name,time])=>`
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;margin-bottom:6px;display:flex;align-items:center;gap:10px;font-size:10px;">
        <span>${ico}</span>
        <span class="badge ${code==='200'?'badge-active':'badge-churn'}">${code}</span>
        <span style="color:#374151;flex:1;">${event} → ${name}</span>
        <span style="color:#94a3b8;">${time}</span>
      </div>`).join('')}
    </div>
  </div>

  <div class="two-col">
    <div class="info-box" style="margin:0;">
      <h4>Event Tersedia</h4>
      <ul>
        <li><code style="font-family:monospace;">donation.created</code> — Derma baru direkod</li>
        <li><code style="font-family:monospace;">donor.created</code> — Donor baru ditambah</li>
        <li><code style="font-family:monospace;">donor.updated</code> — Maklumat donor dikemas kini</li>
      </ul>
    </div>
    <div class="info-box" style="margin:0;">
      <h4>Keselamatan Webhook</h4>
      <p>Setiap webhook boleh dikonfigurasi dengan <strong>Secret Key</strong>. Payload dihantar dengan signature HMAC-SHA256 dalam header <code style="font-family:monospace;">X-Webhook-Signature</code> untuk pengesahan dari pihak penerima.</p>
    </div>
  </div>
</div>

<!-- ══════════════════ 07 STAFF ══════════════════ -->
<div class="section-cover">
  <div class="section-num">07</div>
  <div class="section-title">Pengurusan Staff</div>
  <div class="section-desc">Tambah, edit dan padam akaun staf sistem</div>
</div>

<div class="page">
  <div class="page-header">
    <h2>07 · Pengurusan Staff</h2>
    <p>Panel pengurusan staf — hanya boleh diakses oleh pengguna dengan peranan <strong>Admin</strong>.</p>
  </div>

  <div class="screen">
    <div class="screen-bar">
      <div class="dot dot-r"></div><div class="dot dot-y"></div><div class="dot dot-g"></div>
      <div class="screen-url">app.ihsanku.com/staff · Staff (Admin Only)</div>
    </div>
    <div class="screen-body" style="padding:16px;background:#f8fafc;display:grid;grid-template-columns:1fr 1.4fr;gap:16px;">
      <!-- Add form -->
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;">
        <div style="font-size:13px;font-weight:700;color:#1e293b;margin-bottom:14px;">Tambah Staff Baru</div>
        ${[['Nama Penuh','Ahmad Admin'],['Emel','ahmad@ihsanku.com'],['Kata Laluan','••••••••'],['Peranan','admin']].map(([l,v])=>`
        <div style="margin-bottom:10px;">
          <div style="font-size:10px;font-weight:600;color:#64748b;margin-bottom:3px;">${l}</div>
          <div style="border:1px solid #e2e8f0;border-radius:8px;padding:7px 10px;font-size:11px;color:#374151;background:#f8fafc;">${v}</div>
        </div>`).join('')}
        <button class="btn-primary" style="width:100%;padding:8px;margin-top:4px;">Tambah Staff</button>
      </div>
      <!-- Staff list -->
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <div style="padding:12px 14px;border-bottom:1px solid #f1f5f9;font-size:12px;font-weight:700;color:#1e293b;">Senarai Staff Aktif</div>
        ${[
          ['Ahmad Admin','ahmad@ihsanku.com','admin'],
          ['Siti Manager','siti@ihsanku.com','manager'],
          ['Razif Editor','razif@ihsanku.com','editor'],
          ['Nurul Viewer','nurul@ihsanku.com','viewer'],
        ].map(([n,e,r])=>`
        <div style="padding:10px 14px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;gap:10px;">
          <div class="donor-avatar" style="width:28px;height:28px;font-size:11px;">${n[0]}</div>
          <div style="flex:1;">
            <div style="font-size:11px;font-weight:600;color:#1e293b;">${n}</div>
            <div style="font-size:10px;color:#94a3b8;">${e}</div>
          </div>
          <span class="badge ${r==='admin'?'badge-repeat':r==='manager'?'badge-active':r==='editor'?'badge-new':'badge-dormant'}" style="text-transform:capitalize;">${r}</span>
          <button style="background:none;border:none;color:#f43f5e;font-size:10px;cursor:pointer;padding:4px 8px;border-radius:6px;border:1px solid #fecaca;">🗑 Remove</button>
        </div>`).join('')}
      </div>
    </div>
  </div>

  <div class="warn-box">
    <h4>⚠️ Akses Terhad — Admin Sahaja</h4>
    <p>Halaman Staff hanya boleh diakses oleh pengguna dengan peranan <strong>admin</strong>. Pengguna dengan peranan lain (manager, editor, viewer) tidak akan nampak menu Staff dalam sidebar dan akan diredirect ke Dashboard jika cuba akses terus.</p>
  </div>
</div>

<!-- ══════════════════ 09 DATABASE ══════════════════ -->
<div class="section-cover">
  <div class="section-num">09</div>
  <div class="section-title">Struktur Database</div>
  <div class="section-desc">Schema table PostgreSQL dalam Supabase</div>
</div>

<div class="page">
  <div class="page-header">
    <h2>09 · Struktur Database</h2>
    <p>Semua table dalam Supabase (PostgreSQL) dengan column, jenis data dan keterangan.</p>
  </div>

  <div style="margin-bottom:20px;">
    <div style="font-size:14px;font-weight:700;color:#1e293b;margin-bottom:8px;">Table: <code class="code">donors</code></div>
    <table class="schema-table">
      <thead><tr><th>Column</th><th>Type</th><th>Constraint</th><th>Keterangan</th></tr></thead>
      <tbody>
        <tr><td><code class="code">id</code></td><td><code class="code">uuid</code></td><td><span class="badge pk">PK</span></td><td>Auto-generated UUID</td></tr>
        <tr><td><code class="code">name</code></td><td><code class="code">text</code></td><td>NOT NULL</td><td>Nama penuh donor</td></tr>
        <tr><td><code class="code">phone</code></td><td><code class="code">text</code></td><td><span class="badge uq">UNIQUE*</span></td><td>Nombor telefon (partial unique: bukan null/kosong)</td></tr>
        <tr><td><code class="code">email</code></td><td><code class="code">text</code></td><td><span class="badge uq">UNIQUE*</span></td><td>Emel lowercase (partial unique)</td></tr>
        <tr><td><code class="code">created_at</code></td><td><code class="code">timestamptz</code></td><td>DEFAULT now()</td><td>Tarikh rekod dicipta</td></tr>
        <tr><td><code class="code">updated_at</code></td><td><code class="code">timestamptz</code></td><td>DEFAULT now()</td><td>Tarikh kemaskini terakhir</td></tr>
      </tbody>
    </table>
  </div>

  <div style="margin-bottom:20px;">
    <div style="font-size:14px;font-weight:700;color:#1e293b;margin-bottom:8px;">Table: <code class="code">donations</code></div>
    <table class="schema-table">
      <thead><tr><th>Column</th><th>Type</th><th>Constraint</th><th>Keterangan</th></tr></thead>
      <tbody>
        <tr><td><code class="code">id</code></td><td><code class="code">uuid</code></td><td><span class="badge pk">PK</span></td><td>Auto-generated UUID</td></tr>
        <tr><td><code class="code">donor_id</code></td><td><code class="code">uuid</code></td><td><span class="badge fk">FK → donors.id</span></td><td>Rujuk table donors</td></tr>
        <tr><td><code class="code">donation_date</code></td><td><code class="code">date</code></td><td>NOT NULL</td><td>Tarikh derma (YYYY-MM-DD)</td></tr>
        <tr><td><code class="code">amount</code></td><td><code class="code">numeric(12,2)</code></td><td>≥ 0</td><td>Jumlah derma dalam RM</td></tr>
        <tr><td><code class="code">source</code></td><td><code class="code">text</code></td><td>nullable</td><td>Sumber: Facebook, Youtube/Google, TikTok, DRM, Others</td></tr>
        <tr><td><code class="code">campaign_name</code></td><td><code class="code">text</code></td><td>nullable</td><td>Nama kempen derma</td></tr>
        <tr><td><code class="code">created_at</code></td><td><code class="code">timestamptz</code></td><td>DEFAULT now()</td><td>Tarikh rekod dicipta</td></tr>
      </tbody>
    </table>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
    <div>
      <div style="font-size:14px;font-weight:700;color:#1e293b;margin-bottom:8px;">VIEW: <code class="code">donor_summary</code></div>
      <table class="schema-table">
        <thead><tr><th>Column</th><th>Dikira dari</th></tr></thead>
        <tbody>
          <tr><td><code class="code">kekerapan</code></td><td>COUNT(donations)</td></tr>
          <tr><td><code class="code">jumlah_keseluruhan</code></td><td>SUM(amount)</td></tr>
          <tr><td><code class="code">tarikh_sumbangan_terdahulu</code></td><td>MIN(donation_date)</td></tr>
          <tr><td><code class="code">tarikh_sumbangan_terkini</code></td><td>MAX(donation_date)</td></tr>
          <tr><td><code class="code">highvalue</code></td><td>total ≥ RM1,000 → 'Ya'</td></tr>
          <tr><td><code class="code">aov</code></td><td>total ÷ kekerapan</td></tr>
          <tr><td><code class="code">source</code></td><td>Sumber terkini dari donations</td></tr>
          <tr><td><code class="code">ltv</code></td><td>Sama dengan jumlah_keseluruhan</td></tr>
        </tbody>
      </table>
    </div>
    <div>
      <div style="font-size:14px;font-weight:700;color:#1e293b;margin-bottom:8px;">Tables Lain</div>
      <div class="card" style="margin-bottom:10px;">
        <h4>users</h4>
        <p>Akaun login staff — email, password_hash (scrypt), full_name, role, active status.</p>
      </div>
      <div class="card" style="margin-bottom:10px;">
        <h4>donor_notes</h4>
        <p>Nota dalaman per donor. Satu donor boleh ada banyak nota.</p>
      </div>
      <div class="card">
        <h4>webhooks + webhook_logs</h4>
        <p>Konfigurasi webhook outbound dan log setiap panggilan.</p>
      </div>
    </div>
  </div>
</div>

<!-- ══════════════════ 10 PERANAN ══════════════════ -->
<div class="section-cover">
  <div class="section-num">10</div>
  <div class="section-title">Peranan &amp; Kebenaran</div>
  <div class="section-desc">Matriks akses mengikut peranan pengguna</div>
</div>

<div class="page">
  <div class="page-header">
    <h2>10 · Peranan &amp; Kebenaran</h2>
    <p>Sistem mempunyai 4 peringkat peranan — setiap peranan mempunyai akses berbeza.</p>
  </div>

  <table class="roles-table">
    <thead>
      <tr>
        <th>Fungsi / Halaman</th>
        <th style="text-align:center;">Viewer</th>
        <th style="text-align:center;">Editor</th>
        <th style="text-align:center;">Manager</th>
        <th style="text-align:center;">Admin</th>
      </tr>
    </thead>
    <tbody>
      ${[
        ['Dashboard','✅','✅','✅','✅'],
        ['Donors (senarai)','✅','✅','✅','✅'],
        ['Analytics & Charts','✅','✅','✅','✅'],
        ['Lihat profil donor','✅','✅','✅','✅'],
        ['Tambah derma (manual)','❌','✅','✅','✅'],
        ['Upload CSV bulk','❌','✅','✅','✅'],
        ['Edit maklumat donor','❌','✅','✅','✅'],
        ['Detect & merge Duplicates','❌','❌','✅','✅'],
        ['Urus Webhooks','❌','❌','✅','✅'],
        ['Urus Staff','❌','❌','❌','✅'],
        ['Urus Users (semua akaun)','❌','❌','❌','✅'],
        ['Tukar peranan pengguna','❌','❌','❌','✅'],
      ].map(([f,...roles])=>`
      <tr>
        <td style="font-weight:500;">${f}</td>
        ${roles.map(r=>`<td style="text-align:center;" class="${r==='✅'?'tick':'cross'}">${r}</td>`).join('')}
      </tr>`).join('')}
    </tbody>
  </table>

  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;">
    ${[
      ['Viewer','👁️','#f1f5f9','#475569','Boleh tengok sahaja — tiada kuasa edit atau tambah data.'],
      ['Editor','✏️','#dbeafe','#1e40af','Boleh tambah & edit data donor dan derma.'],
      ['Manager','⚙️','#d1fae5','#065f46','Semua akses Editor + webhooks + duplikat.'],
      ['Admin','🛡️','#fef3c7','#92400e','Akses penuh termasuk staff & user management.'],
    ].map(([r,i,bg,c,d])=>`
    <div style="background:${bg};border-radius:10px;padding:14px;border:1px solid rgba(0,0,0,0.05);">
      <div style="font-size:20px;margin-bottom:8px;">${i}</div>
      <div style="font-size:13px;font-weight:700;color:${c};margin-bottom:4px;">${r}</div>
      <div style="font-size:11px;color:${c};opacity:0.8;line-height:1.5;">${d}</div>
    </div>`).join('')}
  </div>
</div>

<!-- ══════════════════ 11 CSV GUIDE ══════════════════ -->
<div class="section-cover">
  <div class="section-num">11</div>
  <div class="section-title">CSV Import Guide</div>
  <div class="section-desc">Format betul, cara upload dan penyelesaian masalah</div>
</div>

<div class="page">
  <div class="page-header">
    <h2>11 · CSV Import Guide</h2>
    <p>Cara import data derma melalui web upload atau terus ke Supabase.</p>
  </div>

  <div style="background:#0f172a;border-radius:10px;padding:16px;margin-bottom:16px;font-family:monospace;font-size:11px;color:#e2e8f0;line-height:1.8;">
    <div style="color:#94a3b8;margin-bottom:6px;"># Format CSV yang diterima (7 kolum wajib):</div>
    <div style="color:#86efac;">name,phone,email,donation_date,amount,source,campaign</div>
    <div style="color:#e2e8f0;">Ahmad Faris,60112345678,ahmad@gmail.com,2024-01-15,50.00,Facebook,FB-ramadan</div>
    <div style="color:#e2e8f0;">Siti Rahimah,60187654321,siti@gmail.com,2024-02-20,100.00,TikTok,TK-zakat</div>
    <div style="color:#e2e8f0;">Mohd Hafiz,60161112233,hafiz@gmail.com,2024-03-10,250.00,Youtube / Google,YT-dakwah</div>
  </div>

  <div style="margin-bottom:20px;">
    <div style="font-size:13px;font-weight:700;color:#1e293b;margin-bottom:10px;">Pemetaan Source dari Campaign</div>
    <table class="roles-table">
      <thead><tr><th>Prefix Campaign</th><th>Source yang Ditetapkan</th><th>Contoh</th></tr></thead>
      <tbody>
        <tr><td><code class="code">YT*</code> atau <code class="code">GYT*</code></td><td><span class="badge badge-active">Youtube / Google</span></td><td>YT-dakwah, GYT-2024</td></tr>
        <tr><td><code class="code">FB*</code></td><td><span class="badge badge-repeat">Facebook</span></td><td>FB-ramadan, FB-zakat</td></tr>
        <tr><td><code class="code">TK*</code></td><td><span class="badge badge-dormant">TikTok</span></td><td>TK-viral, TK-january</td></tr>
        <tr><td><code class="code">CRM*</code></td><td><span class="badge badge-churn">DRM</span></td><td>CRM-001, CRM-batch</td></tr>
        <tr><td>Lain-lain</td><td><span class="badge badge-new">Others</span></td><td>Manual-01, Walk-in</td></tr>
      </tbody>
    </table>
  </div>

  <div class="flow">
    <div class="flow-step">
      <div class="flow-num">1</div>
      <div class="flow-content">
        <h4>Sedia CSV</h4>
        <p>Pastikan 7 kolum wajib ada: name, phone, email, donation_date (YYYY-MM-DD), amount (nombor), source, campaign</p>
      </div>
    </div>
    <div class="flow-step">
      <div class="flow-num">2</div>
      <div class="flow-content">
        <h4>Upload melalui Web</h4>
        <p>Pergi Add Donation → klik butang Upload CSV → pilih fail → sistem akan proses dalam chunk 300 baris</p>
      </div>
    </div>
    <div class="flow-step">
      <div class="flow-num">3</div>
      <div class="flow-content">
        <h4>Atau Import Terus ke Supabase</h4>
        <p>Jika fail besar atau ada timeout: buat staging table → import CSV → run SQL untuk pindah ke donors & donations → drop staging</p>
      </div>
    </div>
    <div class="flow-step">
      <div class="flow-num">4</div>
      <div class="flow-content">
        <h4>Verify Data</h4>
        <p>Semak bilangan donors dan donations selepas import. Pastikan jumlah match dengan CSV asal.</p>
      </div>
    </div>
  </div>
</div>

<!-- ══════════════════ 12 SETUP ══════════════════ -->
<div class="section-cover">
  <div class="section-num">12</div>
  <div class="section-title">Persediaan Sistem</div>
  <div class="section-desc">Environment variables dan cara setup dari mula</div>
</div>

<div class="page">
  <div class="page-header">
    <h2>12 · Persediaan Sistem</h2>
    <p>Environment variables yang diperlukan dan cara setup deployment baru.</p>
  </div>

  <div style="margin-bottom:20px;">
    <div style="font-size:13px;font-weight:700;color:#1e293b;margin-bottom:10px;">Environment Variables (.env)</div>
    <table class="env-table">
      <thead><tr><th>Variable</th><th>Nilai</th><th>Keterangan</th></tr></thead>
      <tbody>
        <tr><td>SUPABASE_URL</td><td>https://xxxx.supabase.co</td><td>URL projek Supabase anda</td></tr>
        <tr><td>SUPABASE_SERVICE_ROLE_KEY</td><td>eyJ...</td><td>Service role key (bukan anon key)</td></tr>
        <tr><td>ADMIN_EMAIL</td><td>admin@domain.com</td><td>Emel login admin pertama</td></tr>
        <tr><td>ADMIN_PASSWORD</td><td>P@ssword123!</td><td>Kata laluan admin (min 8 aksara)</td></tr>
        <tr><td>TOKEN_SECRET</td><td>random-64-char-hex</td><td>Secret untuk sign JWT token</td></tr>
        <tr><td>PORT</td><td>4000</td><td>Port backend (Railway auto-assign)</td></tr>
      </tbody>
    </table>
  </div>

  <div class="two-col">
    <div>
      <div style="font-size:13px;font-weight:700;color:#1e293b;margin-bottom:10px;">Setup Local</div>
      <div style="background:#0f172a;border-radius:10px;padding:14px;font-family:monospace;font-size:11px;color:#e2e8f0;line-height:2;">
        <div style="color:#94a3b8;"># Clone repo</div>
        <div><span style="color:#86efac;">git clone</span> &lt;repo-url&gt;</div>
        <div><span style="color:#86efac;">cd</span> Database-Analytic-System</div>
        <div style="color:#94a3b8;margin-top:4px;"># Install dependencies</div>
        <div><span style="color:#86efac;">npm install</span></div>
        <div style="color:#94a3b8;margin-top:4px;"># Setup env file</div>
        <div><span style="color:#86efac;">cp</span> .env.example .env</div>
        <div style="color:#94a3b8;margin-top:4px;"># Run development</div>
        <div><span style="color:#fbbf24;">npm run dev</span>    <span style="color:#475569;"># Frontend :5173</span></div>
        <div><span style="color:#fbbf24;">npm run server</span> <span style="color:#475569;"># Backend  :4000</span></div>
      </div>
    </div>
    <div>
      <div style="font-size:13px;font-weight:700;color:#1e293b;margin-bottom:10px;">Deploy ke Railway</div>
      <div class="flow" style="margin:0;">
        <div class="flow-step" style="padding:10px 12px;">
          <div class="flow-num" style="width:22px;height:22px;font-size:10px;">1</div>
          <div class="flow-content"><h4 style="font-size:11px;">Connect GitHub repo ke Railway</h4></div>
        </div>
        <div class="flow-step" style="padding:10px 12px;">
          <div class="flow-num" style="width:22px;height:22px;font-size:10px;">2</div>
          <div class="flow-content"><h4 style="font-size:11px;">Set semua Environment Variables dalam Railway dashboard</h4></div>
        </div>
        <div class="flow-step" style="padding:10px 12px;">
          <div class="flow-num" style="width:22px;height:22px;font-size:10px;">3</div>
          <div class="flow-content"><h4 style="font-size:11px;">Railway auto-deploy setiap push ke <code style="font-family:monospace;">main</code></h4></div>
        </div>
        <div class="flow-step" style="padding:10px 12px;">
          <div class="flow-num" style="width:22px;height:22px;font-size:10px;">4</div>
          <div class="flow-content"><h4 style="font-size:11px;">Setup Supabase tables menggunakan SQL dalam README</h4></div>
        </div>
      </div>
    </div>
  </div>

  <div class="success-box" style="margin-top:16px;">
    <h4>✅ Sistem Sedia Digunakan</h4>
    <p>Setelah semua langkah di atas selesai, akses sistem melalui URL Railway anda. Login dengan ADMIN_EMAIL dan ADMIN_PASSWORD yang ditetapkan dalam environment variables.</p>
  </div>
</div>

<!-- ══════════════════ BACK COVER ══════════════════ -->
<div class="cover" style="page-break-before:always;">
  <div class="cover-badge">IhsanKu Donor Analytics System</div>
  <div style="font-size:48px;margin-bottom:16px;">🤲</div>
  <h1 style="font-size:36px;">Terima Kasih</h1>
  <p class="cover-sub">Untuk sebarang pertanyaan teknikal atau permintaan pengubahsuaian sistem, hubungi pasukan KZD Tech.</p>
  <div class="cover-meta">
    <div class="cover-meta-item"><div class="val" style="font-size:18px;">v1.0</div><div class="lbl">Versi</div></div>
    <div class="cover-meta-item"><div class="val" style="font-size:18px;">Mei 2025</div><div class="lbl">Tarikh</div></div>
    <div class="cover-meta-item"><div class="val" style="font-size:18px;">KZD Tech</div><div class="lbl">Pembangun</div></div>
  </div>
  <div class="cover-footer">IhsanKu · Sistem Analitik Donor · Hak Cipta Terpelihara © 2025</div>
</div>

</body></html>`;

writeFileSync('/tmp/ihsanku-doc.html', html);

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
});

const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'networkidle0' });

await page.pdf({
  path: '/home/user/Database-Analytic-System/IhsanKu-System-Documentation.pdf',
  format: 'A4',
  printBackground: true,
  margin: { top: '0', right: '0', bottom: '0', left: '0' }
});

await browser.close();
console.log('PDF generated successfully!');
